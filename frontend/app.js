document.addEventListener('DOMContentLoaded', () => {
    const foodNameInput = document.getElementById('food-name');
    const suggestionsDiv = document.getElementById('suggestions');
    const quantityInput = document.getElementById('quantity');
    const mealTypeSelect = document.getElementById('meal-type');
    const macroInfoDiv = document.getElementById('macro-info');
    const foodForm = document.getElementById('food-form');
    const themeToggleButton = document.getElementById('theme-toggle');

    // New elements for daily summary and meals list
    const totalCaloriesSpan = document.getElementById('total-calories');
    const totalProteinSpan = document.getElementById('total-protein');
    const totalCarbsSpan = document.getElementById('total-carbs');
    const totalFatSpan = document.getElementById('total-fat');
    const mealsListUl = document.getElementById('meals-list');

    // --- CONFIGURACIÓN ---
    const USDA_API_KEY = 'J3vt0lhEQv2gnTa558QTcd4ECtxfZWkbe6xoivog'; 
    const USDA_API_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
    const FLASK_BACKEND_ADD_URL = 'http://192.168.10.52:8050/agregar_comida';
    const FLASK_BACKEND_GET_TODAY_URL = 'http://192.168.10.52:8050/obtener_comidas_del_dia';

    let selectedFood = null;

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
            const response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${food.fdcId}?api_key=${USDA_API_KEY}`);
            const data = await response.json();

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
            const factor = quantity / 100;

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
            const response = await fetch(FLASK_BACKEND_ADD_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(foodData),
            });
            const result = await response.json();
            if (response.ok) {
                alert('Comida registrada exitosamente: ' + result.message);
                foodForm.reset();
                macroInfoDiv.innerHTML = '';
                selectedFood = null;
                fetchTodayMeals(); // Refresh today's meals and summary
            } else {
                alert('Error al registrar comida: ' + result.error);
            }
        } catch (error) {
            console.error('Error enviando datos al backend:', error);
            alert('Error de conexión con el servidor.');
        }
    }

    // Función para obtener y mostrar las comidas del día
    async function fetchTodayMeals() {
        try {
            const response = await fetch(FLASK_BACKEND_GET_TODAY_URL);
            const meals = await response.json();

            mealsListUl.innerHTML = ''; // Clear previous list
            let totalCalories = 0;
            let totalProtein = 0;
            let totalCarbs = 0;
            let totalFat = 0;

            if (meals && meals.length > 0) {
                meals.forEach(meal => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${meal.tipo_comida}</strong>: ${meal.alimento} (${meal.cantidad}g) - ${meal.calorias} kcal, ${meal.proteinas}g P, ${meal.carbohidratos}g C, ${meal.grasas}g G`;
                    mealsListUl.appendChild(li);

                    totalCalories += parseFloat(meal.calorias);
                    totalProtein += parseFloat(meal.proteinas);
                    totalCarbs += parseFloat(meal.carbohidratos);
                    totalFat += parseFloat(meal.grasas);
                });
            } else {
                mealsListUl.innerHTML = '<li>No hay comidas registradas para hoy.</li>';
            }

            totalCaloriesSpan.textContent = totalCalories.toFixed(2);
            totalProteinSpan.textContent = totalProtein.toFixed(2);
            totalCarbsSpan.textContent = totalCarbs.toFixed(2);
            totalFatSpan.textContent = totalFat.toFixed(2);

        } catch (error) {
            console.error('Error obteniendo comidas del día:', error);
            mealsListUl.innerHTML = '<li style="color: red;">Error al cargar comidas del día.</li>';
            totalCaloriesSpan.textContent = 'Error';
            totalProteinSpan.textContent = 'Error';
            totalCarbsSpan.textContent = 'Error';
            totalFatSpan.textContent = 'Error';
        }
    }

    // --- EVENT LISTENERS ---

    foodNameInput.addEventListener('input', () => {
        searchFood(foodNameInput.value);
    });

    quantityInput.addEventListener('input', displayMacroInfo);

    foodForm.addEventListener('submit', (event) => {
        event.preventDefault();

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

    themeToggleButton.addEventListener('click', toggleTheme);

    // Initial fetch of today's meals when the page loads
    fetchTodayMeals();

    console.log('Tracker de Macros listo.');
});