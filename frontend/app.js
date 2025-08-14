document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const foodNameInput = document.getElementById('food-name');
    const suggestionsDiv = document.getElementById('suggestions');
    const quantityInput = document.getElementById('quantity');
    const mealTypeSelect = document.getElementById('meal-type');
    const macroInfoDiv = document.getElementById('macro-info');
    const foodForm = document.getElementById('food-form');
    const themeToggleButton = document.getElementById('theme-toggle');
    const totalCaloriesSpan = document.getElementById('total-calories');
    const totalProteinSpan = document.getElementById('total-protein');
    const totalCarbsSpan = document.getElementById('total-carbs');
    const totalFatSpan = document.getElementById('total-fat');
    const mealsListUl = document.getElementById('meals-list');
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    const currentDateDisplay = document.getElementById('current-date-display');

    // --- ESTADO DE LA APLICACIÓN ---
    let selectedFood = null;
    let currentDate = new Date(); // Comienza con la fecha de hoy

    // --- CONFIGURACIÓN ---
    // La URL del backend ahora es relativa, no depende de una IP fija.
    const BACKEND_BASE_URL = ''; // Se asume que el frontend se sirve desde el mismo host que el backend

    // --- FUNCIONES ---

    // Formatea un objeto Date a un string 'YYYY-MM-DD'
    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // Actualiza el h3 que muestra la fecha
    function updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        // Formato especial para el día de hoy
        if (formatDate(currentDate) === formatDate(new Date())) {
            currentDateDisplay.textContent = `Hoy, ${currentDate.toLocaleDateString('es-ES', options)}`;
        } else {
            currentDateDisplay.textContent = currentDate.toLocaleDateString('es-ES', options);
        }
    }

    // Cambia el tema (claro/oscuro)
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

    // Busca alimentos usando nuestro propio backend como proxy
    async function searchFood(query) {
        if (query.length < 3) {
            suggestionsDiv.innerHTML = '';
            return;
        }
        try {
            // La petición ahora va a nuestro backend, que es más seguro
            const response = await fetch(`${BACKEND_BASE_URL}/buscar_alimento?query=${query}`);
            const data = await response.json();
            displaySuggestions(data.foods);
        } catch (error) {
            console.error('Error buscando alimentos:', error);
            suggestionsDiv.innerHTML = '<div style="color: red;">Error al buscar alimentos.</div>';
        }
    }

    // Muestra las sugerencias de alimentos
    function displaySuggestions(foods) {
        suggestionsDiv.innerHTML = '';
        if (foods && foods.length > 0) {
            foods.forEach(food => {
                const div = document.createElement('div');
                div.textContent = food.description;
                div.addEventListener('click', () => selectFood(food));
                suggestionsDiv.appendChild(div);
            });
        } else {
            suggestionsDiv.innerHTML = '<div>No se encontraron resultados.</div>';
        }
    }

    // Selecciona un alimento y obtiene sus macros
    async function selectFood(food) {
        foodNameInput.value = food.description;
        suggestionsDiv.innerHTML = '';
        selectedFood = null;

        try {
            // La petición de detalles también va a nuestro backend
            const response = await fetch(`${BACKEND_BASE_URL}/detalles_alimento?fdcId=${food.fdcId}`);
            const nutrientData = await response.json();

            selectedFood = {
                description: food.description,
                calories: nutrientData.calories || 0,
                protein: nutrientData.protein || 0,
                carbs: nutrientData.carbs || 0,
                fat: nutrientData.fat || 0
            };
            displayMacroInfo();

        } catch (error) {
            console.error('Error obteniendo detalles del alimento:', error);
            macroInfoDiv.innerHTML = '<div style="color: red;">Error al cargar detalles.</div>';
        }
    }

    // Muestra la info de macros para el alimento seleccionado
    function displayMacroInfo() {
        if (selectedFood) {
            const quantity = parseFloat(quantityInput.value) || 100;
            const factor = quantity / 100;
            macroInfoDiv.innerHTML = `
                <h3>Información Nutricional (por ${quantity}g):</h3>
                <p>Calorías: <strong>${(selectedFood.calories * factor).toFixed(2)} kcal</strong></p>
                <p>Proteínas: <strong>${(selectedFood.protein * factor).toFixed(2)} g</strong></p>
                <p>Carbohidratos: <strong>${(selectedFood.carbs * factor).toFixed(2)} g</strong></p>
                <p>Grasas: <strong>${(selectedFood.fat * factor).toFixed(2)} g</strong></p>
            `;
        } else {
            macroInfoDiv.innerHTML = '';
        }
    }

    // Envía una nueva comida al backend
    async function sendFoodData(foodData) {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/agregar_comida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(foodData),
            });
            const result = await response.json();
            if (response.ok) {
                alert('Comida registrada exitosamente: ' + result.message);
                foodForm.reset();
                macroInfoDiv.innerHTML = '';
                selectedFood = null;
                fetchMealsForDate(); // Recarga las comidas para la fecha actual
            } else {
                alert('Error al registrar comida: ' + result.error);
            }
        } catch (error) {
            console.error('Error enviando datos al backend:', error);
            alert('Error de conexión con el servidor.');
        }
    }

    // Obtiene y muestra las comidas para la fecha seleccionada (reemplaza a fetchTodayMeals)
    async function fetchMealsForDate() {
        updateDateDisplay();
        const dateStr = formatDate(currentDate);

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/obtener_comidas_del_dia?fecha=${dateStr}`);
            const meals = await response.json();

            mealsListUl.innerHTML = '';
            let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

            if (meals && meals.length > 0) {
                meals.forEach(meal => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${meal.tipo_comida}</strong>: ${meal.alimento} (${meal.cantidad_gr}g) - ${meal.calorias} kcal, ${meal.proteinas}g P, ${meal.carbohidratos}g C, ${meal.grasas}g G`;
                    mealsListUl.appendChild(li);
                    totalCalories += parseFloat(meal.calorias);
                    totalProtein += parseFloat(meal.proteinas);
                    totalCarbs += parseFloat(meal.carbohidratos);
                    totalFat += parseFloat(meal.grasas);
                });
            } else {
                mealsListUl.innerHTML = '<li>No hay comidas registradas para esta fecha.</li>';
            }

            totalCaloriesSpan.textContent = totalCalories.toFixed(2);
            totalProteinSpan.textContent = totalProtein.toFixed(2);
            totalCarbsSpan.textContent = totalCarbs.toFixed(2);
            totalFatSpan.textContent = totalFat.toFixed(2);

        } catch (error) {
            console.error('Error obteniendo comidas:', error);
            mealsListUl.innerHTML = '<li style="color: red;">Error al cargar las comidas.</li>';
        }
    }

    // --- EVENT LISTENERS ---

    foodNameInput.addEventListener('input', () => searchFood(foodNameInput.value));
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
            // Añadimos la fecha al objeto que se envía
            fecha: formatDate(currentDate),
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

    prevDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        fetchMealsForDate();
    });

    nextDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        fetchMealsForDate();
    });

    // --- INICIALIZACIÓN ---
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-mode' : 'light-mode');
    setTheme(savedTheme);
    fetchMealsForDate(); // Carga inicial de datos para el día de hoy

    console.log('Tracker de Macros v2 listo.');
});