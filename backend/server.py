import os
import psycopg2
import psycopg2.pool
import requests
import atexit
from flask import Flask, request, jsonify
from datetime import datetime, date
from flask_cors import CORS
from dotenv import load_dotenv

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

# --- CONFIGURACIÓN DE LA APP ---
app = Flask(__name__)
CORS(app) # Habilitar CORS para todas las rutas

# --- POOL DE CONEXIONES A LA BASE DE DATOS ---
db_pool = psycopg2.pool.SimpleConnectionPool(
    minconn=1,
    maxconn=10,
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    port=os.getenv("DB_PORT")
)

@atexit.register
def close_db_pool():
    if db_pool:
        db_pool.closeall()
    print("Pool de conexiones de la base de datos cerrado.")

# --- FUNCIONES DE CÁLCULO DE CALORÍAS ---
def calculate_bmr_tdee(sex, weight_kg, height_cm, age_years, activity_level):
    if sex.lower() == 'masculino':
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) + 5
    elif sex.lower() == 'femenino':
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) - 161
    else:
        raise ValueError("Sexo no válido para el cálculo de BMR.")

    activity_factors = {
        "sedentario": 1.2,
        "ligeramente_activo": 1.375,
        "moderadamente_activo": 1.55,
        "muy_activo": 1.725,
        "extra_activo": 1.9
    }
    
    if activity_level not in activity_factors:
        raise ValueError("Nivel de actividad no válido.")
    
    tdee = bmr * activity_factors[activity_level]
    return tdee

# --- RUTAS PROXY PARA LA API DE USDA (MÁS SEGURO) ---

USDA_API_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

@app.route('/buscar_alimento', methods=['GET'])
def buscar_alimento():
    query = request.args.get('query')
    api_key = os.getenv('USDA_API_KEY')
    if not query or not api_key:
        return jsonify({"error": "Falta el query o la API key"}), 400
    
    try:
        response = requests.get(f"{USDA_API_BASE_URL}/foods/search?query={query}&api_key={api_key}")
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/detalles_alimento', methods=['GET'])
def detalles_alimento():
    fdc_id = request.args.get('fdcId')
    api_key = os.getenv('USDA_API_KEY')
    if not fdc_id or not api_key:
        return jsonify({"error": "Falta el FDC ID o la API key"}), 400

    try:
        response = requests.get(f"{USDA_API_BASE_URL}/food/{fdc_id}?api_key={api_key}")
        response.raise_for_status()
        data = response.json()
        
        nutrients = data.get('foodNutrients', [])
        parsed_nutrients = {'calories': 0, 'protein': 0, 'carbs': 0, 'fat': 0}

        for n in nutrients:
            nutrient_name = n.get('nutrient', {}).get('name', '').lower()
            unit_name = n.get('nutrient', {}).get('unitName', '').lower()
            amount = n.get('amount', 0)

            if 'energy' in nutrient_name and 'kcal' in unit_name:
                parsed_nutrients['calories'] = amount or 0
            elif 'protein' in nutrient_name:
                parsed_nutrients['protein'] = amount or 0
            elif 'carbohydrate, by difference' in nutrient_name:
                parsed_nutrients['carbs'] = amount or 0
            elif 'total lipid (fat)' in nutrient_name:
                parsed_nutrients['fat'] = amount or 0

        return jsonify(parsed_nutrients)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

# --- RUTAS DE LA API PARA LA BASE DE DATOS ---

@app.route('/')
def index():
    return "Servidor para Tracker de Macros funcionando con PostgreSQL y Pool de Conexiones."

@app.route('/agregar_comida', methods=['POST'])
def agregar_comida():
    data = request.json
    if not data:
        return jsonify({"error": "No se recibieron datos JSON"}), 400

    usuario_id = 1
    fecha = data.get('fecha', datetime.now().strftime("%Y-%m-%d"))
    conn = None
    try:
        conn = db_pool.getconn()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO registros_comida (usuario_id, fecha, tipo_comida, alimento, cantidad_gr, calorias, proteinas, carbohidratos, grasas)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (usuario_id, fecha, data.get('tipo_comida'), data.get('alimento'), data.get('cantidad'), data.get('calorias'), data.get('proteinas'), data.get('carbohidratos'), data.get('grasas'))
        )
        conn.commit()
        cur.close()
        return jsonify({"message": "Comida registrada exitosamente"}), 200
    except Exception as e:
        print(f"Error en /agregar_comida: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.route('/obtener_comidas_del_dia', methods=['GET'])
def obtener_comidas_del_dia():
    fecha_str = request.args.get('fecha', datetime.now().strftime("%Y-%m-%d"))
    usuario_id = 1
    conn = None
    try:
        conn = db_pool.getconn()
        cur = conn.cursor()
        cur.execute(
            """SELECT tipo_comida, alimento, cantidad_gr, calorias, proteinas, carbohidratos, grasas, fecha
               FROM registros_comida WHERE usuario_id = %s AND fecha = %s ORDER BY fecha_registro ASC""",
            (usuario_id, fecha_str)
        )
        rows = cur.fetchall()
        column_names = [desc[0] for desc in cur.description]
        meals_today = [dict(zip(column_names, row)) for row in rows]
        cur.close()
        return jsonify(meals_today), 200
    except Exception as e:
        print(f"Error en /obtener_comidas_del_dia: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

# --- RUTAS PARA GESTIÓN DE USUARIOS ---

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    conn = None
    try:
        conn = db_pool.getconn()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, nombre, email, fecha_nacimiento, sexo, altura_cm, peso_kg, actividad_nivel, objetivo_calorico_diario, imc, porcentaje_grasa
               FROM usuarios WHERE id = %s""",
            (user_id,)
        )
        user_data = cur.fetchone()
        cur.close()

        if user_data:
            column_names = [desc[0] for desc in cur.description]
            user_dict = dict(zip(column_names, user_data))
            if 'fecha_nacimiento' in user_dict and isinstance(user_dict['fecha_nacimiento'], date):
                user_dict['fecha_nacimiento'] = user_dict['fecha_nacimiento'].isoformat()
            return jsonify(user_dict), 200
        else:
            return jsonify({"error": "Usuario no encontrado"}), 404
    except Exception as e:
        print(f"Error en /api/users/{user_id} (GET): {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user_profile(user_id):
    data = request.json
    if not data:
        return jsonify({"error": "No se recibieron datos JSON"}), 400

    nombre = data.get('nombre')
    email = data.get('email')
    fecha_nacimiento_str = data.get('fecha_nacimiento')
    sexo = data.get('sexo')
    altura_cm = data.get('altura_cm')
    peso_kg = data.get('peso_kg')
    actividad_nivel = data.get('actividad_nivel')

    age_years = None
    if fecha_nacimiento_str:
        try:
            dob = datetime.strptime(fecha_nacimiento_str, '%Y-%m-%d').date()
            today = date.today()
            age_years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except ValueError:
            return jsonify({"error": "Formato de fecha de nacimiento inválido. Use YYYY-MM-DD."}), 400

    objetivo_calorico_diario = None
    imc = None
    porcentaje_grasa = None

    # Ensure age_years is defined before use in the all() check
    # The age_years calculation block is already above this, so it should be defined.

    # Check if all necessary components for TDEE calculation are present and valid
    if all([sexo, peso_kg is not None, altura_cm is not None, age_years is not None, actividad_nivel]):
        try:
            # Use 'sexo' variable, not 'sex'
            objetivo_calorico_diario = calculate_bmr_tdee(sexo, peso_kg, altura_cm, age_years, actividad_nivel)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # Calculate IMC
    if peso_kg is not None and altura_cm is not None and altura_cm > 0:
        altura_m = altura_cm / 100
        imc = peso_kg / (altura_m ** 2)

    # Calculate Body Fat Percentage (simplified formula)
    if imc is not None and age_years is not None and sexo:
        if sexo.lower() == 'masculino':
            porcentaje_grasa = (1.20 * imc) + (0.23 * age_years) - 16.2
        elif sexo.lower() == 'femenino':
            porcentaje_grasa = (1.20 * imc) + (0.23 * age_years) - 5.4

    conn = None
    try:
        conn = db_pool.getconn()
        cur = conn.cursor()

        update_fields = []
        update_values = []

        if nombre: update_fields.append("nombre = %s"); update_values.append(nombre)
        if email: update_fields.append("email = %s"); update_values.append(email)
        if fecha_nacimiento_str: update_fields.append("fecha_nacimiento = %s"); update_values.append(fecha_nacimiento_str)
        if sexo: update_fields.append("sexo = %s"); update_values.append(sexo)
        if altura_cm is not None: update_fields.append("altura_cm = %s"); update_values.append(altura_cm)
        if peso_kg is not None: update_fields.append("peso_kg = %s"); update_values.append(peso_kg)
        if actividad_nivel: update_fields.append("actividad_nivel = %s"); update_values.append(actividad_nivel)
        if objetivo_calorico_diario is not None: update_fields.append("objetivo_calorico_diario = %s"); update_values.append(objetivo_calorico_diario)
        if imc is not None: update_fields.append("imc = %s"); update_values.append(imc)
        if porcentaje_grasa is not None: update_fields.append("porcentaje_grasa = %s"); update_values.append(porcentaje_grasa)

        if not update_fields:
            return jsonify({"message": "No hay datos para actualizar"}), 200

        query = f"UPDATE usuarios SET {', '.join(update_fields)} WHERE id = %s RETURNING id"
        update_values.append(user_id)

        cur.execute(query, tuple(update_values))
        updated_id = cur.fetchone()
        conn.commit()
        cur.close()

        if updated_id:
            return jsonify({"message": "Perfil de usuario actualizado exitosamente", "user_id": updated_id[0]}), 200
        else:
            return jsonify({"error": "Usuario no encontrado para actualizar"}), 404

    except Exception as e:
        print(f"Error en /api/users/{user_id} (PUT): {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8050)