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

// Simple initial version of the configurator
const PumpConfigurator = () => {
    const [type, setType] = React.useState('P');
    
    return React.createElement(Card, { className: 'max-w-4xl mx-auto mt-8' },
        React.createElement(CardHeader, null,
            React.createElement(CardTitle, null, 'Hydraulic Pump Configurator')
        ),
        React.createElement('div', { className: 'p-4' },
            React.createElement('div', { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium mb-2' }, 
                    'Type'
                ),
                React.createElement('select', {
                    className: 'w-full p-2 border rounded',
                    value: type,
                    onChange: (e) => setType(e.target.value)
                }, [
                    React.createElement('option', { value: 'P', key: 'P' }, 'Pump (P)'),
                    React.createElement('option', { value: 'M', key: 'M' }, 'Motor (M)')
                ])
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