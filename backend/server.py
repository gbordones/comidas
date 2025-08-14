
import os
import psycopg2
import psycopg2.pool
import requests
import atexit
from flask import Flask, request, jsonify
from datetime import datetime
from flask_cors import CORS
from dotenv import load_dotenv

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

# --- CONFIGURACIÓN DE LA APP ---
app = Flask(__name__)
CORS(app) # Habilitar CORS para todas las rutas

# --- POOL DE CONEXIONES A LA BASE DE DATOS ---
# Se crea un pool de conexiones al iniciar la app, lo que es mucho más eficiente.
db_pool = psycopg2.pool.SimpleConnectionPool(
    minconn=1,
    maxconn=10, # Adecuado para una app de este tamaño
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    port=os.getenv("DB_PORT")
)

# Función para cerrar el pool de conexiones al salir de la aplicación
@atexit.register
def close_db_pool():
    if db_pool:
        db_pool.closeall()
    print("Pool de conexiones de la base de datos cerrado.")

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8050)
