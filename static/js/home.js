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
            <select class="lift-type w-full p-2 bg-gray-700 rounded mb-2">
                <option value="">Нет лифта</option>
                <option value="passenger">Пассажирский</option>
                <option value="cargo">Грузовой</option>
            </select>
            <div class="lift-power-input hidden">
                <label class="block mb-2">Мощность лифта (кВт)</label>
                <input type="number" class="lift-power w-full p-2 bg-gray-700 rounded mb-2">
                <label class="block mb-2">Месячное потребление (кВт⋅ч, необязательно)</label>
                <input type="number" class="lift-consumption w-full p-2 bg-gray-700 rounded">
            </div>
        `;
        liftsContainer.appendChild(liftEntry);

        // Add event listener to new lift type select
        const liftType = liftEntry.querySelector('.lift-type');
        const liftPowerInput = liftEntry.querySelector('.lift-power-input');
        liftType.addEventListener('change', function () {
            if (this.value) {
                liftPowerInput.classList.remove('hidden');
                document.getElementById('osbb-phase-count').value = '3';
                document.getElementById('osbb-phase-count').disabled = true;
            } else {
                liftPowerInput.classList.add('hidden');
                document.getElementById('osbb-phase-count').disabled = false;
            }
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
        `;
        pumpsContainer.appendChild(pumpEntry);
    });

    // OSBB form submission
    osbbForm.addEventListener('submit', function (e) {
        e.preventDefault();

        let totalConsumption = 0;
        const backupTime = parseFloat(document.getElementById('osbb-backup-time').value);
        const phases = parseInt(document.getElementById('osbb-phase-count').value);

        // Calculate lift consumption
        document.querySelectorAll('.lift-entry').forEach(liftEntry => {
            const liftType = liftEntry.querySelector('.lift-type').value;
            if (liftType) {
                const consumption = parseFloat(liftEntry.querySelector('.lift-consumption').value);
                if (consumption) {
                    totalConsumption += consumption;
                } else {
                    const power = parseFloat(liftEntry.querySelector('.lift-power').value) || 0;
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
                totalConsumption += (power * 720); // 720 hours per month
            }
        });

        // Calculate hourly consumption
        const hourlyConsumption = totalConsumption / 720; // 720 hours in a month

        // Add 20% safety margin
        const consumptionWithMargin = totalConsumption * 1.2;

        // Determine inverter and battery requirements
        let recommendedInverter = '';
        let recommendedBatteries = '';
        let controllerNeeded = false;
        let batteryCount = Math.ceil((consumptionWithMargin / 720) * backupTime / 5.1); // 5.1 kWh per battery

        let isHighVoltageSystems = batteryCount > 8;

        if (isHighVoltageSystems) {
            // Switch to high-voltage system
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
                {model: 'BOS-G60', energy: 61.44, batteries: 12}
            ];
            const selectedSystem = highVoltageSystems.find(system => system.batteries >= batteryCount);
            recommendedBatteries = `BOS-GM5.1 (${selectedSystem.batteries} шт.)`;
            controllerNeeded = true;
            batteryCount = selectedSystem.batteries;
        } else {
            recommendedBatteries = 'Deye SE-G5.1Pro-B';
        }

        let calculatedError = false;

        if (phases === 1) {
            if (consumptionWithMargin <= 5000) {
                recommendedInverter = 'Deye SUN-5K-SG04LP1-EU 5kW';
            } else if (consumptionWithMargin <= 6000) {
                recommendedInverter = 'Deye SUN-6K-SG04LP1-EU 6kW';
            } else if (consumptionWithMargin <= 8000) {
                recommendedInverter = 'Deye SUN-8K-SG01LP1-EU 8kW';
            } else if (consumptionWithMargin <= 10000) {
                recommendedInverter = 'Deye SUN-10K-SG02LP1-EU 10kW';
            } else if (consumptionWithMargin <= 12000) {
                recommendedInverter = 'Deye SUN-12K-SG02LP1-EU 12kW';
            } else if (consumptionWithMargin <= 16000) {
                recommendedInverter = 'Deye SUN-16K-SG02LP1-EU 16kW';
            } else {
                calculatedError = true;
            }
        } else if (phases === 3) {
            if (!isHighVoltageSystems && consumptionWithMargin <= 12000) {
                if (consumptionWithMargin <= 5000) {
                    recommendedInverter = 'Deye SUN-5K-SG04LP3-EU 5kW';
                } else if (consumptionWithMargin <= 6000) {
                    recommendedInverter = 'Deye SUN-6K-SG04LP3-EU 6kW';
                } else if (consumptionWithMargin <= 8000) {
                    recommendedInverter = 'Deye SUN-8K-SG01LP3-EU 8kW';
                } else if (consumptionWithMargin <= 10000) {
                    recommendedInverter = 'Deye SUN-10K-SG02LP3-EU 10kW';
                } else if (consumptionWithMargin <= 12000) {
                    recommendedInverter = 'Deye SUN-12K-SG02LP3-EU 12kW';
                }
            } else {
                if (consumptionWithMargin <= 5000) {
                    recommendedInverter = 'Deye SUN-5K-SG01HP3-EU 5kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 10000) {
                    recommendedInverter = 'Deye SUN-10K-SG01HP3-EU 10kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 12000) {
                    recommendedInverter = 'Deye SUN-12K-SG01HP3-EU 12kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 15000) {
                    recommendedInverter = 'Deye SUN-15K-SG01HP3-EU 15kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 20000) {
                    recommendedInverter = 'Deye SUN-20K-SG01HP3-EU 20kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 30000) {
                    recommendedInverter = 'Deye SUN-30K-SG01HP3-EU 30kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 30000) {
                    recommendedInverter = 'Deye SUN-50K-SG01HP3-EU 50kW';
                    controllerNeeded = true;
                } else {
                    calculatedError = true;
                }
            }
        }

        if (batteryCount > 24) {
            calculatedError = true;
        }


        // Display results
        document.getElementById('results').classList.remove('hidden');
        if (calculatedError) {
            document.getElementById('results-content').innerHTML = `
                <p>Ошибка: Расчет не может быть выполнен. Пожалуйста, свяжитесь с нами для получения дополнительной информации.</p>
            `;
        } else {
            // Display results
            document.getElementById('results-content').innerHTML = `
            <p>Общее месячное потребление: ${totalConsumption.toFixed(2)} кВт⋅ч</p>
            <p>Среднее потребление в час: ${hourlyConsumption.toFixed(2)} кВт</p>
            <p>Время резервирования: ${backupTime} часов</p>
            <p>Количество фаз: ${phases}</p>
            <p>Рекомендуемый инвертор: ${recommendedInverter}</p>
            <p>Рекомендуемые батареи: ${recommendedBatteries} (${batteryCount} шт.)</p>
            ${controllerNeeded ? '<p>Требуется контроллер Deye HVB750V/100A</p>' : ''}
        `;
        }
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


        // Calculate hourly consumption
        const hourlyConsumption = monthlyConsumption / 720;

        // Add 20% safety margin
        const consumptionWithMargin = monthlyConsumption * 1.2;

        // Use the same inverter and battery selection logic as OSBB calculator
        let recommendedInverter = '';
        let recommendedBatteries = '';
        let controllerNeeded = false;
        let batteryCount = Math.ceil((consumptionWithMargin / 720) * backupTime / 5.1);

        let isHighVoltageSystems = batteryCount > 8;

        if (isHighVoltageSystems) {
            // Switch to high-voltage system
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
                {model: 'BOS-G60', energy: 61.44, batteries: 12}
            ];
            const selectedSystem = highVoltageSystems.find(system => system.batteries >= batteryCount);
            recommendedBatteries = `BOS-GM5.1 (${selectedSystem.batteries} шт.)`;
            controllerNeeded = true;
            batteryCount = selectedSystem.batteries;
        } else {
            recommendedBatteries = 'Deye SE-G5.1Pro-B';
        }

        let calculatedError = false;

        if (phases === 1) {
            if (consumptionWithMargin <= 5000) {
                recommendedInverter = 'Deye SUN-5K-SG04LP1-EU 5kW';
            } else if (consumptionWithMargin <= 6000) {
                recommendedInverter = 'Deye SUN-6K-SG04LP1-EU 6kW';
            } else if (consumptionWithMargin <= 8000) {
                recommendedInverter = 'Deye SUN-8K-SG01LP1-EU 8kW';
            } else if (consumptionWithMargin <= 10000) {
                recommendedInverter = 'Deye SUN-10K-SG02LP1-EU 10kW';
            } else if (consumptionWithMargin <= 12000) {
                recommendedInverter = 'Deye SUN-12K-SG02LP1-EU 12kW';
            } else if (consumptionWithMargin <= 16000) {
                recommendedInverter = 'Deye SUN-16K-SG02LP1-EU 16kW';
            } else {
                calculatedError = true;
            }
        } else if (phases === 3) {
            if (!isHighVoltageSystems && consumptionWithMargin <= 12000) {
                if (consumptionWithMargin <= 5000) {
                    recommendedInverter = 'Deye SUN-5K-SG04LP3-EU 5kW';
                } else if (consumptionWithMargin <= 6000) {
                    recommendedInverter = 'Deye SUN-6K-SG04LP3-EU 6kW';
                } else if (consumptionWithMargin <= 8000) {
                    recommendedInverter = 'Deye SUN-8K-SG01LP3-EU 8kW';
                } else if (consumptionWithMargin <= 10000) {
                    recommendedInverter = 'Deye SUN-10K-SG02LP3-EU 10kW';
                } else if (consumptionWithMargin <= 12000) {
                    recommendedInverter = 'Deye SUN-12K-SG02LP3-EU 12kW';
                }
            } else {
                if (consumptionWithMargin <= 5000) {
                    recommendedInverter = 'Deye SUN-5K-SG01HP3-EU 5kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 10000) {
                    recommendedInverter = 'Deye SUN-10K-SG01HP3-EU 10kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 12000) {
                    recommendedInverter = 'Deye SUN-12K-SG01HP3-EU 12kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 15000) {
                    recommendedInverter = 'Deye SUN-15K-SG01HP3-EU 15kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 20000) {
                    recommendedInverter = 'Deye SUN-20K-SG01HP3-EU 20kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 30000) {
                    recommendedInverter = 'Deye SUN-30K-SG01HP3-EU 30kW';
                    controllerNeeded = true;
                } else if (consumptionWithMargin <= 30000) {
                    recommendedInverter = 'Deye SUN-50K-SG01HP3-EU 50kW';
                    controllerNeeded = true;
                } else {
                    calculatedError = true;
                }
            }
        }

        if (batteryCount > 24) {
            calculatedError = true;
        }


        // Display results
        document.getElementById('results').classList.remove('hidden');
        if (calculatedError) {
            document.getElementById('results-content').innerHTML = `
                <p>Ошибка: Расчет не может быть выполнен. Пожалуйста, свяжитесь с нами для получения дополнительной информации.</p>
            `;
        } else {
            document.getElementById('results-content').innerHTML = `
            <p>Ток вводного автомата: ${inputCurrent.toFixed(2)} А</p>
            <p>Расчетная мощность: ${inputPower.toFixed(2)} кВт</p>
            <p>Общее месячное потребление: ${monthlyConsumption.toFixed(2)} кВт⋅ч</p>
            <p>Среднее потребление в час: ${hourlyConsumption.toFixed(2)} кВт</p>
            <p>Время резервирования: ${backupTime} часов</p>
            <p>Количество фаз: ${phases}</p>
            <p>Рекомендуемый инвертор: ${recommendedInverter}</p>
            <p>Рекомендуемые батареи: ${recommendedBatteries} (${batteryCount} шт.)</p>
            ${controllerNeeded ? '<p>Требуется контроллер Deye HVB750V/100A</p>' : ''}
        `;
        }
    });
});