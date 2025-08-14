-- Script para crear la estructura de la base de datos appfitness en PostgreSQL

-- Tabla para almacenar los datos de los usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255), -- Para futuras funcionalidades de login
    fecha_nacimiento DATE,
    sexo VARCHAR(10), -- 'masculino', 'femenino', 'otro'
    altura_cm FLOAT,
    peso_kg FLOAT,
    objetivo VARCHAR(50), -- 'perder_peso', 'mantener', 'ganar_musculo'
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para registrar las comidas de los usuarios
CREATE TABLE registros_comida (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_comida VARCHAR(50) NOT NULL, -- 'Desayuno', 'Almuerzo', 'Cena', 'Snack'
    alimento VARCHAR(255) NOT NULL,
    cantidad_gr FLOAT NOT NULL,
    calorias FLOAT NOT NULL,
    proteinas FLOAT NOT NULL,
    carbohidratos FLOAT NOT NULL,
    grasas FLOAT NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para registrar los ejercicios de los usuarios
CREATE TABLE registros_ejercicio (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    nombre_ejercicio VARCHAR(150) NOT NULL,
    duracion_minutos INTEGER,
    calorias_quemadas FLOAT,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento de las búsquedas
CREATE INDEX idx_registros_comida_usuario_fecha ON registros_comida(usuario_id, fecha);
CREATE INDEX idx_registros_ejercicio_usuario_fecha ON registros_ejercicio(usuario_id, fecha);

-- Comentario para confirmar que el script se ha ejecutado
-- ¡Estructura de la base de datos creada exitosamente!
