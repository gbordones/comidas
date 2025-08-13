document.addEventListener('DOMContentLoaded', () => {
    const foodNameInput = document.getElementById('food-name');
    const suggestionsDiv = document.getElementById('suggestions');
    const quantityInput = document.getElementById('quantity');
    const mealTypeSelect = document.getElementById('meal-type');
    const macroInfoDiv = document.getElementById('macro-info');
    const foodForm = document.getElementById('food-form');
    const themeToggleButton = document.getElementById('theme-toggle'); // New element

    // --- CONFIGURACIÓN ---
    // Reemplaza 'YOUR_USDA_API_KEY' con tu clave API real de USDA FoodData Central
    const USDA_API_KEY = 'J3vt0lhEQv2gnTa558QTcd4ECtxfZWkbe6xoivog';
    const USDA_API_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
    const FLASK_BACKEND_URL = 'http://127.0.0.1:5001/agregar_comida';

    let selectedFood = null; // Para almacenar los datos del alimento seleccionado

    // --- FUNCIONES ---

    // Theme Toggle Functionality
    function setTheme(theme) {
        document.body.classList.remove('light-mode', 'dark-mode');
        document.body.classList.add(theme);
        localStorage.setItem('theme', theme);
    }

    function toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'light-mode';
        const newTheme = currentTheme === 'light-mode' ? 'dark-mode' : 'light-mode';
        setTheme(newTheme);
    }

    // Apply saved theme on load
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-mode' : 'light-mode');
    setTheme(savedTheme);


    // Función para buscar alimentos en la API de USDA
    async function searchFood(query) {
        if (query.length < 3) {
            suggestionsDiv.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`${USDA_API_URL}?query=${query}&api_key=${USDA_API_KEY}`);
            const data = await response.json();
            displaySuggestions(data.foods);
        } catch (error) {
            console.error('Error buscando alimentos:', error);
            suggestionsDiv.innerHTML = '<div style="color: red;">Error al buscar alimentos.</div>';
        }
    }

    // Función para mostrar sugerencias
    function displaySuggestions(foods) {
        suggestionsDiv.innerHTML = '';
        if (foods && foods.length > 0) {
            foods.forEach(food => {
                const div = document.createElement('div');
                div.textContent = food.description;
                div.dataset.fdcId = food.fdcId;
                div.addEventListener('click', () => selectFood(food));
                suggestionsDiv.appendChild(div);
            });
        } else {
            suggestionsDiv.innerHTML = '<div>No se encontraron resultados.</div>';
        }
    }

    // Función para seleccionar un alimento de las sugerencias
    async function selectFood(food) {
        foodNameInput.value = food.description;
        suggestionsDiv.innerHTML = '';
        selectedFood = null; // Resetear el alimento seleccionado

        try {
            // Obtener detalles nutricionales completos del alimento seleccionado
            const response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${food.fdcId}?api_key=${USDA_API_KEY}`);
            const data = await response.json();

            // Buscar los macronutrientes principales (proteínas, grasas, carbohidratos)
            const nutrients = data.foodNutrients;
            let calories = 0;
            let protein = 0;
            let carbs = 0;
            let fat = 0;

            nutrients.forEach(n => {
                const nutrientNameLower = n.nutrient.name.toLowerCase();
                const unitNameLower = n.nutrient.unitName ? n.nutrient.unitName.toLowerCase() : '';

                if (nutrientNameLower.includes('energy') && unitNameLower.includes('kcal')) {
                    calories = n.amount;
                } else if (nutrientNameLower.includes('protein')) {
                    protein = n.amount;
                } else if (nutrientNameLower.includes('carbohydrate') && nutrientNameLower.includes('by difference')) {
                    carbs = n.amount;
                } else if (nutrientNameLower.includes('total lipid') || nutrientNameLower.includes('fat')) {
                    fat = n.amount;
                }
            });

            selectedFood = {
                description: food.description,
                calories: calories,
                protein: protein,
                carbs: carbs,
                fat: fat
            };
            displayMacroInfo();

        } catch (error) {
            console.error('Error obteniendo detalles del alimento:', error);
            macroInfoDiv.innerHTML = '<div style="color: red;">Error al cargar detalles nutricionales.</div>';
        }
    }

    // Función para mostrar la información de macronutrientes
    function displayMacroInfo() {
        if (selectedFood) {
            const quantity = parseFloat(quantityInput.value) || 100;
            const factor = quantity / 100; // La API da valores por 100g

            macroInfoDiv.innerHTML = `
                <h3>Información Nutricional (por ${quantity}g):</h3>
                <p>Calorías: <strong>${(selectedFood.calories * factor).toFixed(2)} kcal</strong></p>
                <p>Proteínas: <strong>${(selectedFood.protein * factor).toFixed(2)} g</strong></p>
                <p>Carbohidratos: <strong>${(selectedFood.carbs * factor).toFixed(2)} g</strong></p>
                <p>Grasas: <strong>${(selectedFood.fat * factor).toFixed(2)} g</strong></strong></p>
            `;
        } else {
            macroInfoDiv.innerHTML = '';
        }
    }

    // Función para enviar los datos al backend de Flask
    async function sendFoodData(foodData) {
        try {
            const response = await fetch(FLASK_BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(foodData),
            });
            const result = await response.json();
            if (response.ok) {
                alert('Comida registrada exitosamente: ' + result.message);
                foodForm.reset(); // Limpiar el formulario
                macroInfoDiv.innerHTML = ''; // Limpiar info de macros
                selectedFood = null; // Resetear alimento seleccionado
            } else {
                alert('Error al registrar comida: ' + result.error);
            }
        } catch (error) {
            console.error('Error enviando datos al backend:', error);
            alert('Error de conexión con el servidor.');
        }
    }

    // --- EVENT LISTENERS ---

    foodNameInput.addEventListener('input', () => {
        searchFood(foodNameInput.value);
    });

    quantityInput.addEventListener('input', displayMacroInfo);

    foodForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevenir el envío tradicional del formulario

        if (!selectedFood) {
            alert('Por favor, selecciona un alimento de la lista de sugerencias.');
            return;
        }

        const quantity = parseFloat(quantityInput.value) || 0;
        if (quantity <= 0) {
            alert('Por favor, introduce una cantidad válida.');
            return;
        }

        const factor = quantity / 100;

        const foodData = {
            tipo_comida: mealTypeSelect.value,
            alimento: selectedFood.description,
            cantidad: quantity,
            calorias: (selectedFood.calories * factor).toFixed(2),
            proteinas: (selectedFood.protein * factor).toFixed(2),
            carbohidratos: (selectedFood.carbs * factor).toFixed(2),
            grasas: (selectedFood.fat * factor).toFixed(2)
        };

        sendFoodData(foodData);
    });

    themeToggleButton.addEventListener('click', toggleTheme); // New event listener

    console.log('Tracker de Macros listo.');
});
