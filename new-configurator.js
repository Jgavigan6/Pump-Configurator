// Simple test component first to make sure everything works
const TestComponent = () => {
    return React.createElement('div', { className: 'p-4 text-xl' }, 'Pump Configurator Test');
};

// Render the test component
ReactDOM.render(
    React.createElement(TestComponent),
    document.getElementById('root')
);
