// Function to parse the markdown data
async function parseMarkdownData(markdownText) {
  const sections = markdownText.split('\n## ');
  const data = {
    shaftEndCovers: [],
    gearHousings: [],
    driveGearSets: {},
    idlerGearSets: [],
    pecCover: {},
    shaftStyles: [],
    // Fixed rotation options
    rotationOptions: [
      { code: '1', description: 'CW' },
      { code: '2', description: 'CCW' },
      { code: '3', description: 'Bi rotational' },
      { code: '4', description: 'CW with bearing' },
      { code: '5', description: 'CCW with bearing' },
      { code: '6', description: 'Bi rotational with bearing' },
      { code: '8', description: 'Birotational motor with 1-1/4" NPT case drain with bearing' },
      { code: '9', description: 'Birotational motor with 1-1/4" NPT case drain without bearing' }
    ]
  };

  sections.forEach(section => {
    if (section.includes('Shaft End Cover (SEC)')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      data.shaftEndCovers = lines.slice(2).map(line => {
        const [code, partNumber, description] = line.split('|').slice(1, -1).map(s => s.trim());
        return { code, partNumber, description };
      });
    }
    else if (section.includes('P.E.C Cover')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      const [description, partNumber] = lines[2].split('|').slice(1, -1).map(s => s.trim());
      data.pecCover = { description, partNumber };
    }
    else if (section.includes('Gear Housing')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      data.gearHousings = lines.slice(2).map(line => {
        const [code, partNumber, description] = line.split('|').slice(1, -1).map(s => s.trim());
        return { code, partNumber, description };
      });
    }
    else if (section.includes('Drive Gear Sets') && !section.includes('Idler')) {
      const headerMatch = section.match(/Code (\d+)/);
      if (headerMatch) {
        const styleCode = headerMatch[1];
        if (!data.driveGearSets[styleCode]) {
          data.driveGearSets[styleCode] = {};
        }

        const lines = section.split('\n').filter(line => line.includes('|'));
        lines.slice(2).forEach(line => {
          const [code, partNumber] = line.split('|').slice(1, -1).map(s => s.trim());
          data.driveGearSets[styleCode][code] = partNumber;
        });

        const styleDesc = section.match(/\((.*?)\)/)[1];
        if (!data.shaftStyles.find(style => style.code === styleCode)) {
          data.shaftStyles.push({
            code: styleCode,
            description: styleDesc
          });
        }
      }
    }
    else if (section.includes('Idler Gear Sets')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      data.idlerGearSets = lines.slice(2).map(line => {
        const [code, partNumber, description] = line.split('|').slice(1, -1).map(s => s.trim());
        return { code, partNumber, description };
      });
    }
  });

  return data;
}

let seriesData = null;

async function loadSeriesData() {
  try {
    const response = await fetch('120-series.md');
    const markdownText = await response.text();
    seriesData = await parseMarkdownData(markdownText);
    initializeConfigurator();
  } catch (error) {
    console.error('Error loading series data:', error);
    document.getElementById('root').innerHTML = 'Error loading configurator data. Please check the console for details.';
  }
}

const PumpConfigurator = () => {
  const [config, setConfig] = React.useState({
    type: '',
    series: '',
    pumpType: '',
    rotation: '',
    secCode: '',
    gearSize: '',
    shaftStyle: '',
    additionalGearSizes: [],
    portingCodes: [''],
    additionalPortingCodes: []
  });

  const [bom, setBom] = React.useState([]);

  // Create empty option for dropdowns
  const createEmptyOption = () => 
    React.createElement('option', { value: '' }, '-- Select --');

  // Create select field with empty first option
  const createSelectField = (label, value, options, onChange) => {
    return React.createElement('div', { className: 'mb-4' },
      React.createElement('label', { className: 'block text-sm font-medium mb-2' }, label),
      React.createElement('select', {
        className: 'w-full p-2 border rounded',
        value: value,
        onChange: (e) => onChange(e.target.value)
      }, [
        createEmptyOption(),
        ...options.map(option => 
          React.createElement('option', { 
            value: option.value || option.code,
            key: option.value || option.code
          }, option.label || `${option.code} - ${option.description}`)
        )
      ])
    );
  };

  return React.createElement('div', { className: 'bg-white shadow rounded-lg max-w-4xl mx-auto' },
    // Header
    React.createElement('div', { className: 'px-4 py-5 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-2xl font-bold' }, 
        'Hydraulic Pump Configurator'
      )
    ),
    
    // Content
    React.createElement('div', { className: 'p-4 space-y-6' },
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
        (value) => {
          const newConfig = { ...config, pumpType: value };
          if (value === 'single') {
            newConfig.additionalGearSizes = [];
            newConfig.additionalPortingCodes = [];
          } else {
            const count = value === 'tandem' ? 1 : value === 'triple' ? 2 : 3;
            newConfig.additionalGearSizes = Array(count).fill('');
            newConfig.additionalPortingCodes = Array(count).fill('');
          }
          setConfig(newConfig);
        }
      ),
      
      // Rest of your selectors...
      createSelectField('Rotation', config.rotation,
        seriesData.rotationOptions,
        (value) => setConfig({ ...config, rotation: value })
      ),
      
      createSelectField('Shaft End Cover', config.secCode,
        seriesData.shaftEndCovers,
        (value) => setConfig({ ...config, secCode: value })
      ),
      
      createSelectField('Gear Size', config.gearSize,
        seriesData.gearHousings,
        (value) => setConfig({ ...config, gearSize: value })
      ),

      createSelectField('Shaft Style', config.shaftStyle,
        seriesData.shaftStyles,
        (value) => setConfig({ ...config, shaftStyle: value })
      ),

      // Model Code Display
      config.type && config.pumpType && config.rotation && config.secCode && config.gearSize && 
      React.createElement('div', { className: 'mt-8 p-4 bg-gray-100 rounded' },
        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, 'Model Code:'),
        React.createElement('div', { className: 'font-mono text-lg' }, generateModelCode(config))
      )
    )
  );
};

function generateModelCode(config) {
  if (!config.type || !config.rotation || !config.secCode || !config.gearSize || !config.shaftStyle) {
    return '';
  }

  let code = `${config.type}${config.series}A${config.rotation}${config.secCode}`;
  code += config.portingCodes[0] || 'XXXX';
  code += `${config.gearSize}-${config.shaftStyle}`;
  
  if (config.pumpType !== 'single' && config.additionalGearSizes.length > 0) {
    config.additionalGearSizes.forEach((size, index) => {
      if (size) {
        code += (config.additionalPortingCodes[index] || 'XXXX');
        code += `${size}-${index + 1}`;
      }
    });
  }
  
  return code;
}

function initializeConfigurator() {
  ReactDOM.render(
    React.createElement(PumpConfigurator),
    document.getElementById('root')
  );
}

window.onload = loadSeriesData;