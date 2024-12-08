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
                {limit: 3600, model: 'Deye SUN-3,6K-SG03LP1-EU 3,6kW', pvCount: 8},
                {limit: 5000, model: 'Deye SUN-5K-SG04LP1-EU 5kW', pvCount: 10},
                {limit: 6000, model: 'Deye SUN-6K-SG03LP1-EU 6kW', pvCount: 12},
                {limit: 8000, model: 'Deye SUN-8K-SG01LP1-EU 8kW', pvCount: 16},
                {limit: 10000, model: 'Deye SUN-10K-SG02LP1-EU 10kW', pvCount: 20},
                {limit: 12000, model: 'Deye SUN-12K-SG02LP1-EU 12kW', pvCount: 24},
                {limit: 16000, model: 'Deye SUN-16K-SG01LP1-EU 16kW', pvCount: 36},
            ],
            3: isHighVoltage
                ? [
                    {limit: 5000, model: 'Deye SUN-5K-SG01HP3-EU 5kW', controller: true, pvCount: 10},
                    {limit: 10000, model: 'Deye SUN-10K-SG01HP3-EU 10kW', controller: true, pvCount: 2},
                    {limit: 12000, model: 'Deye SUN-12K-SG01HP3-EU 12kW', controller: true, pvCount: 24},
                    {limit: 15000, model: 'Deye SUN-15K-SG01HP3-EU 15kW', controller: true, pvCount: 32},
                    {limit: 20000, model: 'Deye SUN-20K-SG01HP3-EU 20kW', controller: true, pvCount: 44},
                    {limit: 30000, model: 'Deye SUN-30K-SG01HP3-EU 30kW', controller: true, pvCount: 66},
                    {limit: 50000, model: 'Deye SUN-50K-SG01HP3-EU 50kW', controller: true, pvCount: 112},
                ]
                : [
                    {limit: 5000, model: 'Deye SUN-5K-SG04LP3-EU 5kW', pvCount: 10},
                    {limit: 6000, model: 'Deye SUN-6K-SG04LP3-EU 6kW', pvCount: 12},
                    {limit: 8000, model: 'Deye SUN-8K-SG04LP3-EU 8kW', pvCount: 16},
                    {limit: 10000, model: 'Deye SUN-10K-SG04LP3-EU 10kW', pvCount: 20},
                    {limit: 12000, model: 'Deye SUN-12K-SG04LP3-EU 12kW', pvCount: 24},
                ],
        };

        const selectedInverter = inverters[phases].find(inv => consumption <= inv.limit);

        return selectedInverter
            ? {inverter: selectedInverter.model, controllerNeeded: !!selectedInverter.controller, error: false, pvCount: selectedInverter.pvCount}
            : {inverter: '', controllerNeeded: false, error: true, pvCount: 0};
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

    const consumptionWithMargin = Math.max(monthlyConsumption / 720, totalPowerKvt * 1000);

// High voltage system detection
    const batteryForInverter = totalPowerKvt * 1.2 * 2 / 5.1;
    let batteryCount = Math.ceil((monthlyConsumption * 1.2 / 720) * backupTime / 5.1) < batteryForInverter
        ? Math.ceil(batteryForInverter)
        : Math.ceil((monthlyConsumption * 1.2 / 720) * backupTime / 5.1);
    const isHighVoltageSystems = batteryCount > 12 || consumptionWithMargin > 12000;
    let recommendedInverter = '';
    let calculatedError = false;

// Select battery system or fallback
    let recommendedBatteries;
    let controllerNeeded;
    let controllerCount;
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
    let pvCount;
    if (inverterSelection.error) {
        calculatedError = true;
    } else {
        if (isHighVoltageSystems && phases === 1) {
            calculatedError = true;
        } else {
            pvCount = inverterSelection.pvCount;
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

    displayResults(calculatedError, resultContent, totalConsumption, hourlyConsumption, batteryCount * 4.8 / hourlyConsumption, phases, recommendedInverter, recommendedBatteries, batteryCount, controllerNeeded, controllerCount, pvCount);

    // Function to display error or results
    function displayResults(error, resultContent, totalConsumption, hourlyConsumption, backupTime, phases, recommendedInverter, recommendedBatteries, batteryCount, controllerNeeded, controllerCount, pvCount) {
        resultContent.innerHTML = error
            ? `<p>Помилка: Розрахунок не може бути виконаний. Будь ласка, зв'яжіться з нами для отримання додаткової інформації.</p>`
            : `
                <p>Загальне місячне споживання: ${totalConsumption.toFixed(2)} кВт⋅год</p>
                <p>Середнє споживання за годину: ${hourlyConsumption.toFixed(2)} кВт</p>
                <p>Фактичний час резервування: ${backupTime.toFixed(0)} год.</p>
                <p>Кількість фаз: ${phases}</p>
                <br>
                <h2>Попередні рекомендації по обладднанню:</h2>
                <p>Рекомендований інвертор: ${recommendedInverter}</p>
                <p>Рекомендовані акумулятори: ${recommendedBatteries} (${batteryCount} шт.)</p>
                ${controllerNeeded > 0 ? `<p>Потрібен контролер Deye HVB750V/100A (${controllerCount} шт.)</p>` : ''}
                <br>
                ${pvCount ? `<p>Рекомендована кількість сонячних панелей Longi Solar Hi-MO 6m LR5-72HTH 580 Вт: ${pvCount} шт.</p>` : ''}
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
        <label class="block mb-2">Ліфт ${liftCount}</label>
        <div class="grid grid-cols-1 gap-2">
            <div>
                <label class="block mb-2">Тип ліфта</label>
                <select class="lift-type w-full p-2 bg-gray-700 rounded">
                    <option value="">Виберіть тип</option>
                    <option value="passenger">Пасажирский</option>
                    <option value="cargo">Вантажний</option>
                </select>
            </div>
            <div class="lift-power-input hidden">
                <label class="block mb-2">Потужність (кВт)</label>
                <input type="number" class="lift-power w-full p-2 bg-gray-700 rounded mb-2">
                <label class="block mb-2">Місячне споживання (кВт⋅год, необов'язково)</label>
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
                <label class="block mb-2">Потужність (кВт)</label>
                <input type="number" class="pump-power w-full p-2 bg-gray-700 rounded">
            </div>
            <div>
                <label class="block mb-2">Місячне споживання (кВт⋅год, необов'язково)</label>
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

        const monthlyConsumption = parseFloat(document.getElementById('osbb-monthly-consumption').value);
        let totalConsumption = monthlyConsumption ? monthlyConsumption : 0;
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

        if (totalPower === 0) {
            totalPower = totalConsumption / 360 * 1.2;
        }

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
            (inputCurrent * 400 * Math.sqrt(3) / 1000); // Three-phase power calculation
        const monthlyConsumption = parseFloat(document.getElementById('private-monthly-consumption').value) || (inputPower * 720);
        const backupTime = parseFloat(document.getElementById('private-backup-time').value);

        // Add 20% safety margin
        calculateInverterAndBatteries(inputPower, monthlyConsumption, phases, backupTime)
    });
});