function calculateInverterAndBatteries(totalPowerKvt, monthlyConsumption, phases, backupTime) {

    /**
     * Select inverter based on consumption and phase count.
     * @param {number} consumption - Total consumption with margin.
     * @param {number} phases - Number of phases (1 or 3).
     * @param {boolean} isHighVoltage - Whether the system is high voltage.
     * @returns {Object} - Object with inverter, controllerNeeded, and error state.
     */
    function selectInverter(consumption, phases, isHighVoltage) {
        const inverters = {
            1: [
                {limit: 3600, model: 'Deye SUN-3,6K-SG03LP1-EU 3,6kW'},
                {limit: 5000, model: 'Deye SUN-5K-SG04LP1-EU 5kW'},
                {limit: 6000, model: 'Deye SUN-6K-SG03LP1-EU 6kW'},
                {limit: 8000, model: 'Deye SUN-8K-SG01LP1-EU 8kW'},
                {limit: 10000, model: 'Deye SUN-10K-SG02LP1-EU 10kW'},
                {limit: 12000, model: 'Deye SUN-12K-SG02LP1-EU 12kW'},
                {limit: 16000, model: 'Deye SUN-16K-SG01LP1-EU 16kW'},
            ],
            3: isHighVoltage
                ? [
                    {limit: 5000, model: 'Deye SUN-5K-SG01HP3-EU 5kW', controller: true},
                    {limit: 10000, model: 'Deye SUN-10K-SG01HP3-EU 10kW', controller: true},
                    {limit: 12000, model: 'Deye SUN-12K-SG01HP3-EU 12kW', controller: true},
                    {limit: 15000, model: 'Deye SUN-15K-SG01HP3-EU 15kW', controller: true},
                    {limit: 20000, model: 'Deye SUN-20K-SG01HP3-EU 20kW', controller: true},
                    {limit: 30000, model: 'Deye SUN-30K-SG01HP3-EU 30kW', controller: true},
                    {limit: 50000, model: 'Deye SUN-50K-SG01HP3-EU 50kW', controller: true},
                ]
                : [
                    {limit: 5000, model: 'Deye SUN-5K-SG04LP3-EU 5kW'},
                    {limit: 6000, model: 'Deye SUN-6K-SG04LP3-EU 6kW'},
                    {limit: 8000, model: 'Deye SUN-8K-SG04LP3-EU 8kW'},
                    {limit: 10000, model: 'Deye SUN-10K-SG04LP3-EU 10kW'},
                    {limit: 12000, model: 'Deye SUN-12K-SG04LP3-EU 12kW'},
                ],
        };

        const selectedInverter = inverters[phases].find(inv => consumption <= inv.limit);

        return selectedInverter
            ? {inverter: selectedInverter.model, controllerNeeded: !!selectedInverter.controller, error: false}
            : {inverter: '', controllerNeeded: false, error: true};
    }

    /**
     * Select battery systems for high voltage.
     * @param {number} batteryCount - Total required batteries.
     * @returns {Object} - Object with battery details and error state.
     */
    function selectBatterySystem(batteryCount) {
        const highVoltageSystems = [
            {model: 'BOS-G15', energy: 15.36, batteries: 3},
            {model: 'BOS-G20', energy: 20.48, batteries: 4},
            {model: 'BOS-G25', energy: 25.6, batteries: 5},
            {model: 'BOS-G30', energy: 30.72, batteries: 6},
            {model: 'BOS-G35', energy: 35.84, batteries: 7},
            {model: 'BOS-G40', energy: 40.96, batteries: 8},
            {model: 'BOS-G45', energy: 46.08, batteries: 9},
            {model: 'BOS-G50', energy: 51.2, batteries: 10},
            {model: 'BOS-G55', energy: 56.32, batteries: 11},
            {model: 'BOS-G60', energy: 61.44, batteries: 12},
        ];

        let remainingBatteries = batteryCount;
        const systems = [];
        let totalControllers = 0;

        // Calculate the number of systems needed
        const systemSize = Math.ceil(remainingBatteries / 12);
        const batteriesPerSystem = Math.ceil(remainingBatteries / systemSize);

        // Distribute batteries into systems
        for (let i = 0; i < systemSize; i++) {
            const selectedSystem = highVoltageSystems.find(system => system.batteries >= batteriesPerSystem);
            if (!selectedSystem) break; // Avoid infinite loop in case of an error
            systems.push(selectedSystem);
            remainingBatteries -= selectedSystem.batteries;
            totalControllers++;
        }

        // Add extra batteries if needed to ensure equal distribution
        if (remainingBatteries > 0) {
            const extraBatteries = batteriesPerSystem - remainingBatteries;
            systems[systems.length - 1].batteries += extraBatteries;
        }

        const valid = remainingBatteries <= 0;

        return valid
            ? {systems, controllers: totalControllers, error: false}
            : {systems: [], controllers: 0, error: true};
    }

    const consumptionWithMargin = Math.max(monthlyConsumption, totalPowerKvt * 1000) * 1.2;

// High voltage system detection
    const batteryForInverter = totalPowerKvt * 2 / 5.1;
    let batteryCount = Math.ceil((monthlyConsumption * 1.2 / 720) * backupTime / 5.1) < batteryForInverter
        ? batteryForInverter
        : Math.ceil((monthlyConsumption * 1.2 / 720) * backupTime / 5.1);
    const isHighVoltageSystems = batteryCount > 12 || phases === 3 || consumptionWithMargin > 12000;
    let recommendedInverter = '';
    let calculatedError = false;

// Select battery system or fallback
    let recommendedBatteries;
    if (isHighVoltageSystems) {
        const batterySelection = selectBatterySystem(batteryCount);
        if (batterySelection.error) {
            calculatedError = true;
        } else {
            batteryCount = batterySelection.systems.reduce((sum, system) => sum + system.batteries, 0);
            recommendedBatteries = batterySelection.systems
                .map(system => `${system.model} (${system.batteries} шт.)`)
                .join(', ');
            controllerNeeded = true;
            controllerCount = batterySelection.controllers;
        }
    } else {
        recommendedBatteries = 'Deye SE-G5.1Pro-B';
    }

// Select inverter
    const inverterSelection = selectInverter(consumptionWithMargin, phases, isHighVoltageSystems);
    if (inverterSelection.error) {
        calculatedError = true;
    } else {
        if (isHighVoltageSystems && phases !== 3) {
            calculatedError = true;
        } else {
            recommendedInverter = inverterSelection.inverter;
            controllerNeeded = inverterSelection.controllerNeeded;
        }
    }

    const resultContent = document.getElementById('results-content');
    const totalConsumption = monthlyConsumption;
    const hourlyConsumption = totalConsumption / 720;

    if (!controllerNeeded) {
        controllerCount = 0;
    }

    displayResults(calculatedError, resultContent, totalConsumption, hourlyConsumption, batteryCount * 4.8 / hourlyConsumption, phases, recommendedInverter, recommendedBatteries, batteryCount, controllerNeeded);

    // Function to display error or results
    function displayResults(error, resultContent, totalConsumption, hourlyConsumption, backupTime, phases, recommendedInverter, recommendedBatteries, batteryCount, controllerNeeded) {
        resultContent.innerHTML = error
            ? `<p>Ошибка: Расчет не может быть выполнен. Пожалуйста, свяжитесь с нами для получения информации.</p>`
            : `
                <p>Общее месячное потребление: ${totalConsumption.toFixed(2)} кВт⋅ч</p>
                <p>Среднее потребление в час: ${hourlyConsumption.toFixed(2)} кВт</p>
                <p>Фактическое время резервирования: ${backupTime.toFixed(0)} ч.</p>
                <p>Количество фаз: ${phases}</p>
                <br>
                <p>Рекомендуемый инвертор: ${recommendedInverter}</p>
                <p>Рекомендуемые батареи: ${recommendedBatteries} (${batteryCount} шт.)</p>
                ${controllerNeeded > 0 ? `<p>Требуется контроллер Deye HVB750V/100A ( ${controllerCount} шт.)</p>` : ''}
            `;
        document.getElementById('results').classList.remove('hidden');
    }
}


document.addEventListener('DOMContentLoaded', function () {
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const calculatorTabs = document.querySelectorAll('.calculator-tab');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all tabs and buttons
            calculatorTabs.forEach(tab => tab.classList.remove('active'));
            tabButtons.forEach(btn => btn.classList.remove('active'));

            // Add active class to selected tab and button
            const tabId = button.dataset.tab;
            document.getElementById(`${tabId}-calculator`).classList.add('active');
            button.classList.add('active');
        });
    });

    // OSBB Calculator functionality
    const osbbForm = document.getElementById('osbb-form');
    const addLiftButton = document.getElementById('add-lift');
    const addPumpButton = document.getElementById('add-pump');
    const liftsContainer = document.getElementById('lifts-container');
    const pumpsContainer = document.getElementById('pumps-container');

    // Add lift functionality
    addLiftButton.addEventListener('click', () => {
        const liftCount = liftsContainer.children.length + 1;
        const liftEntry = document.createElement('div');
        liftEntry.className = 'lift-entry mb-4';
        liftEntry.innerHTML = `
        <label class="block mb-2">Лифт ${liftCount}</label>
        <div class="grid grid-cols-1 gap-2">
            <div>
                <label class="block mb-2">Тип лифта</label>
                <select class="lift-type w-full p-2 bg-gray-700 rounded">
                    <option value="">Выберите тип</option>
                    <option value="passenger">Пассажирский</option>
                    <option value="cargo">Грузовой</option>
                </select>
            </div>
            <div class="lift-power-input hidden">
                <label class="block mb-2">Мощность лифта (кВт)</label>
                <input type="number" class="lift-power w-full p-2 bg-gray-700 rounded mb-2">
                <label class="block mb-2">Месячное потребление (кВт⋅ч, необязательно)</label>
                <input type="number" class="lift-consumption w-full p-2 bg-gray-700 rounded">
            </div>
        </div>
        <button type="button" class="delete-lift bg-red-600 hover:bg-red-700 px-4 py-2 rounded mt-2">Удалить</button>
    `;
        liftsContainer.appendChild(liftEntry);

        const liftType = liftEntry.querySelector('.lift-type');
        const liftPowerInput = liftEntry.querySelector('.lift-power-input');
        const liftPower = liftEntry.querySelector('.lift-power');
        liftType.addEventListener('change', function () {
            if (this.value) {
                liftPowerInput.classList.remove('hidden');
                document.getElementById('osbb-phase-count').value = '3';
                document.getElementById('osbb-phase-count').disabled = true;
                liftPower.value = this.value === 'cargo' ? 10 : 7;
            } else {
                liftPowerInput.classList.add('hidden');
                document.getElementById('osbb-phase-count').disabled = false;
                liftPower.value = '';
            }
        });

        const deleteLiftButton = liftEntry.querySelector('.delete-lift');
        deleteLiftButton.addEventListener('click', () => {
            liftsContainer.removeChild(liftEntry);
        });
    });

    // Add pump functionality
    addPumpButton.addEventListener('click', () => {
        const pumpCount = pumpsContainer.children.length + 1;
        const pumpEntry = document.createElement('div');
        pumpEntry.className = 'pump-entry mb-4';
        pumpEntry.innerHTML = `
        <label class="block mb-2">Насос ${pumpCount}</label>
        <div class="grid grid-cols-1 gap-2">
            <div>
                <label class="block mb-2">Мощность (кВт)</label>
                <input type="number" class="pump-power w-full p-2 bg-gray-700 rounded">
            </div>
            <div>
                <label class="block mb-2">Месячное потребление (кВт⋅ч, необязательно)</label>
                <input type="number" class="pump-consumption w-full p-2 bg-gray-700 rounded">
            </div>
        </div>
        <button type="button" class="delete-pump bg-red-600 hover:bg-red-700 px-4 py-2 rounded mt-2">Удалить</button>
    `;
        pumpsContainer.appendChild(pumpEntry);

        const deletePumpButton = pumpEntry.querySelector('.delete-pump');
        deletePumpButton.addEventListener('click', () => {
            pumpsContainer.removeChild(pumpEntry);
        });
    });

    // OSBB form submission
    osbbForm.addEventListener('submit', function (e) {
        e.preventDefault();

        let totalConsumption = 0;
        const backupTime = parseFloat(document.getElementById('osbb-backup-time').value);
        const phases = parseInt(document.getElementById('osbb-phase-count').value);
        let totalPower = 0;

        // Calculate lift consumption
        document.querySelectorAll('.lift-entry').forEach(liftEntry => {
            const liftType = liftEntry.querySelector('.lift-type').value;
            if (liftType) {
                const consumption = parseFloat(liftEntry.querySelector('.lift-consumption').value);
                if (consumption) {
                    totalConsumption += consumption;
                } else {
                    const power = parseFloat(liftEntry.querySelector('.lift-power').value) || 0;
                    totalPower += power;
                    totalConsumption += (power * 168); // 168 hours per month
                }
            }
        });

        // Calculate pump consumption
        document.querySelectorAll('.pump-entry').forEach(pumpEntry => {
            const consumption = parseFloat(pumpEntry.querySelector('.pump-consumption').value);
            if (consumption) {
                totalConsumption += consumption;
            } else {
                const power = parseFloat(pumpEntry.querySelector('.pump-power').value) || 0;
                totalPower += power;
                totalConsumption += (power * 720); // 720 hours per month
            }
        });

        calculateInverterAndBatteries(totalPower, totalConsumption, phases, backupTime)
    });

    // Private home form submission
    const privateForm = document.getElementById('private-form');
    privateForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const inputCurrent = parseFloat(document.getElementById('input-current').value);
        const phases = parseInt(document.getElementById('private-phase-count').value);
        const inputPower = phases === 1 ?
            (inputCurrent * 230 / 1000) : // Single phase power calculation
            (inputCurrent * 400 * Math.sqrt(3) / 1000); // Three phase power calculation
        const monthlyConsumption = parseFloat(document.getElementById('private-monthly-consumption').value) || (inputPower * 720);
        const backupTime = parseFloat(document.getElementById('private-backup-time').value);

        // Add 20% safety margin
        calculateInverterAndBatteries(inputPower, monthlyConsumption, phases, backupTime)
    });
});