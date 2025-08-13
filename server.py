from flask import Flask, request, jsonify
from openpyxl import load_workbook
from datetime import datetime
from flask_cors import CORS # Import CORS

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

@app.route('/')
def index():
    return "Servidor para Tracker de Macros funcionando."

@app.route('/agregar_comida', methods=['POST'])
def agregar_comida():
    data = request.json
    if not data:
        return jsonify({"error": "No se recibieron datos JSON"}), 400

    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tipo_comida = data.get('tipo_comida')
    alimento = data.get('alimento')
    cantidad = data.get('cantidad')
    calorias = data.get('calorias')
    proteinas = data.get('proteinas')
    carbohidratos = data.get('carbohidratos')
    grasas = data.get('grasas')

    try:
        # Cargar el libro de trabajo existente
        wb = load_workbook('alimentos.xlsx')
        ws = wb.active

        # Añadir una nueva fila con los datos
        ws.append([fecha, tipo_comida, alimento, cantidad, calorias, proteinas, carbohidratos, grasas])

        # Guardar el libro de trabajo
        wb.save('alimentos.xlsx')

        return jsonify({"message": "Comida registrada exitosamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
