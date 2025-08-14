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

    // Nuevos elementos para el perfil de usuario
    const profileButton = document.getElementById('profile-button');
    const profileModal = document.getElementById('profile-modal');
    const closeButton = profileModal.querySelector('.close-button');
    const profileForm = document.getElementById('profile-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const profileDobInput = document.getElementById('profile-dob');
    const profileSexSelect = document.getElementById('profile-sex');
    const profileHeightInput = document.getElementById('profile-height');
    const profileWeightInput = document.getElementById('profile-weight');
    const profileActivitySelect = document.getElementById('profile-activity');

    // Nuevos elementos para el resumen de calorías
    const dailyGoalCaloriesSpan = document.getElementById('daily-goal-calories');
    const remainingCaloriesSpan = document.getElementById('remaining-calories');

    // --- ESTADO DE LA APLICACIÓN ---
    let selectedFood = null;
    let currentDate = new Date(); // Comienza con la fecha de hoy
    const USER_ID = 1; // ID de usuario temporalmente fijo

    // --- CONFIGURACIÓN ---
    const BACKEND_BASE_URL = 'http://192.168.10.52:8050';

    // --- FUNCIONES GENERALES ---

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    function updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (formatDate(currentDate) === formatDate(new Date())) {
            currentDateDisplay.textContent = `Hoy, ${currentDate.toLocaleDateString('es-ES', options)}`;
        } else {
            currentDateDisplay.textContent = currentDate.toLocaleDateString('es-ES', options);
        }
    }

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

    // --- FUNCIONES DE ALIMENTOS ---

    async function searchFood(query) {
        if (query.length < 3) {
            suggestionsDiv.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/buscar_alimento?query=${query}`);
            const data = await response.json();
            displaySuggestions(data.foods);
        } catch (error) {
            console.error('Error buscando alimentos:', error);
            suggestionsDiv.innerHTML = '<div style="color: red;">Error al buscar alimentos.</div>';
        }
    }

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

    async function selectFood(food) {
        foodNameInput.value = food.description;
        suggestionsDiv.innerHTML = '';
        selectedFood = null;

        try {
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

    // --- FUNCIONES DE PERFIL DE USUARIO ---

    async function fetchUserProfile() {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/api/users/${USER_ID}`);
            if (response.status === 404) {
                // Usuario no encontrado, puede que sea la primera vez. No hay problema.
                console.log("Usuario no encontrado, asumiendo primer uso.");
                return null;
            }
            const userData = await response.json();
            if (response.ok) {
                // Rellenar el formulario de perfil
                profileNameInput.value = userData.nombre || '';
                profileEmailInput.value = userData.email || '';
                profileDobInput.value = userData.fecha_nacimiento || '';
                profileSexSelect.value = userData.sexo || '';
                profileHeightInput.value = userData.altura_cm || '';
                profileWeightInput.value = userData.peso_kg || '';
                profileActivitySelect.value = userData.actividad_nivel || '';
                
                // Actualizar el objetivo calórico diario en el resumen
                dailyGoalCaloriesSpan.textContent = (userData.objetivo_calorico_diario || 0).toFixed(0);
                return userData;
            } else {
                console.error('Error al obtener perfil de usuario:', userData.error);
                return null;
            }
        } catch (error) {
            console.error('Error de conexión al obtener perfil de usuario:', error);
            return null;
        }
    }

    async function saveUserProfile(event) {
        event.preventDefault();

        const userData = {
            nombre: profileNameInput.value,
            email: profileEmailInput.value,
            fecha_nacimiento: profileDobInput.value,
            sexo: profileSexSelect.value,
            altura_cm: parseFloat(profileHeightInput.value),
            peso_kg: parseFloat(profileWeightInput.value),
            actividad_nivel: profileActivitySelect.value
        };

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/api/users/${USER_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
            const result = await response.json();
            if (response.ok) {
                alert('Perfil actualizado exitosamente!');
                profileModal.style.display = 'none'; // Cerrar modal
                fetchUserProfile(); // Recargar perfil para actualizar el objetivo calórico
                fetchMealsForDate(); // Recalcular calorías restantes
            } else {
                alert('Error al guardar perfil: ' + result.error);
            }
        } catch (error) {
            console.error('Error de conexión al guardar perfil:', error);
            alert('Error de conexión con el servidor al guardar perfil.');
        }
    }

    // --- FUNCIONES DE RESUMEN DIARIO Y COMIDAS ---

    async function fetchMealsForDate() {
        updateDateDisplay();
        const dateStr = formatDate(currentDate);

        let userProfile = await fetchUserProfile(); // Obtener perfil para el objetivo calórico
        let dailyGoal = userProfile ? userProfile.objetivo_calorico_diario || 0 : 0;
        dailyGoalCaloriesSpan.textContent = dailyGoal.toFixed(0);

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/obtener_comidas_del_dia?fecha=${dateStr}`);
            const meals = await response.json();

            mealsListUl.innerHTML = '';
            let totalCalories = 0;
            let totalProtein = 0;
            let totalCarbs = 0;
            let totalFat = 0;

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

            // Calcular y mostrar calorías restantes
            const remainingCalories = dailyGoal - totalCalories;
            remainingCaloriesSpan.textContent = remainingCalories.toFixed(0);

        } catch (error) {
            console.error('Error obteniendo comidas:', error);
            mealsListUl.innerHTML = '<li style="color: red;">Error al cargar las comidas.</li>';
            totalCaloriesSpan.textContent = 'Error';
            totalProteinSpan.textContent = 'Error';
            totalCarbsSpan.textContent = 'Error';
            totalFatSpan.textContent = 'Error';
            remainingCaloriesSpan.textContent = 'Error';
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

    // Eventos del modal de perfil
    profileButton.addEventListener('click', () => {
        profileModal.style.display = 'flex'; // Mostrar modal
        fetchUserProfile(); // Cargar datos actuales al abrir
    });

    closeButton.addEventListener('click', () => {
        profileModal.style.display = 'none'; // Ocultar modal
    });

    // Cerrar modal si se hace clic fuera del contenido
    window.addEventListener('click', (event) => {
        if (event.target == profileModal) {
            profileModal.style.display = 'none';
        }
    });

    profileForm.addEventListener('submit', saveUserProfile);

    // --- INICIALIZACIÓN ---
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-mode' : 'light-mode');
    setTheme(savedTheme);
    fetchMealsForDate(); // Carga inicial de datos para el día de hoy y perfil

    console.log('Tracker de Macros v3 listo.');
});