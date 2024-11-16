// Basic UI components
const Card = ({ children, className }) => (
    React.createElement('div', { 
        className: `bg-white shadow rounded-lg ${className || ''}`
    }, children)
);

const CardHeader = ({ children }) => (
    React.createElement('div', { 
        className: 'px-4 py-5 border-b border-gray-200'
    }, children)
);

const CardTitle = ({ children, className }) => (
    React.createElement('h3', { 
        className: `text-lg font-medium ${className || ''}`
    }, children)
);

// Series data
const series120Data = {
    shaftEndCovers: [
        { code: '08', partNumber: '0420-040-501', description: '2-Bolt B' },
        { code: '05', partNumber: '0420-041-501', description: '2-Bolt A' },
        { code: '07', partNumber: '0420-048-501', description: '2-Bolt B Type II' },
        { code: '53', partNumber: '0420-042-501', description: '4-Bolt B' },
        { code: '38', partNumber: '0420-049-501', description: '4-Bolt "R" Flange' },
        { code: '16', partNumber: '0420-043-501', description: '6-Bolt Rnd 2.62"' },
        { code: '57', partNumber: '0420-045-501', description: '2 & 4-Bolt B' }
    ],
    rotationOptions: [
        { code: '1', description: 'CW' },
        { code: '2', description: 'CCW' },
        { code: '3', description: 'Bi rotational' },
        { code: '4', description: 'CW with bearing' },
        { code: '5', description: 'CCW with bearing' }
    ],
    gearHousings: [
        { code: '05', description: '½"- .985 C.I.D.' },
        { code: '07', description: '¾"- 1.47 C.I.D.' },
        { code: '10', description: '1"- 1.97 C.I.D.' },
        { code: '12', description: '1-1/4"- 2.46 C.I.D.' },
        { code: '15', description: '1-1/2"- 2.95 C.I.D.' },
        { code: '17', description: '1-3/4"- 3.44 C.I.D.' },
        { code: '20', description: '2"- 3.94 C.I.D.' }
    ]
};

const PumpConfigurator = () => {
    const [config, setConfig] = React.useState({
        type: 'P',
        pumpType: 'single',
        rotation: '1',
        secCode: '53',
        gearSize: '20'
    });

    const createSelectField = (label, value, options, onChange) => {
        return React.createElement('div', { className: 'mb-4' },
            React.createElement('label', { className: 'block text-sm font-medium mb-2' }, label),
            React.createElement('select', {
                className: 'w-full p-2 border rounded',
                value: value,
                onChange: (e) => onChange(e.target.value)
            }, options.map(option => 
                React.createElement('option', { 
                    value: option.value || option.code,
                    key: option.value || option.code
                }, option.label || `${option.code} - ${option.description}`)
            ))
        );
    };

    return React.createElement(Card, { className: 'max-w-4xl mx-auto mt-8' },
        React.createElement(CardHeader, null,
            React.createElement(CardTitle, null, 'Hydraulic Pump Configurator')
        ),
        React.createElement('div', { className: 'p-4' },
            // Type selector
            createSelectField('Type', config.type, 
                [
                    { value: 'P', label: 'Pump (P)' },
                    { value: 'M', label: 'Motor (M)' }
                ],
                (value) => setConfig({ ...config, type: value })
            ),
            
            // Pump Type selector
            createSelectField('Pump Type', config.pumpType,
                [
                    { value: 'single', label: 'Single' },
                    { value: 'tandem', label: 'Tandem' },
                    { value: 'triple', label: 'Triple' },
                    { value: 'quad', label: 'Quad' }
                ],
                (value) => setConfig({ ...config, pumpType: value })
            ),
            
            // Rotation selector
            createSelectField('Rotation', config.rotation,
                series120Data.rotationOptions,
                (value) => setConfig({ ...config, rotation: value })
            ),
            
            // Shaft End Cover selector
            createSelectField('Shaft End Cover', config.secCode,
                series120Data.shaftEndCovers,
                (value) => setConfig({ ...config, secCode: value })
            ),
            
            // Gear Size selector
            createSelectField('Gear Size', config.gearSize,
                series120Data.gearHousings,
                (value) => setConfig({ ...config, gearSize: value })
            )
        )
    );
};

// Render the component
window.onload = function() {
    ReactDOM.render(
        React.createElement(PumpConfigurator),
        document.getElementById('root')
    );
};