// Add at the very top of configurator.js
console.log('Loading configurator...');

// Add this before loadSeriesData function
async function checkFileAvailability() {
  try {
    const response = await fetch('120-series.md');
    console.log('File check response:', response.status);
    const text = await response.text();
    console.log('First 100 characters of file:', text.substring(0, 100));
  } catch (error) {
    console.error('File check error:', error);
  }
}

// Call this after window.onload = loadSeriesData;
checkFileAvailability();// Markdown parser function
async function parseMarkdownData(markdownText) {
  const sections = markdownText.split('\n## ');
  const data = {
    shaftEndCovers: [],
    gearHousings: [],
    driveGearSets: {},
    idlerGearSets: [],
    pecCover: {},
    shaftStyles: [],
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
          data.shaftStyles.push({ code: styleCode, description: styleDesc });
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
    // Use fetch instead of window.fs.readFile
    const response = await fetch('120-series.md');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const fileContent = await response.text();
    seriesData = await parseMarkdownData(fileContent);
    initializeConfigurator();
  } catch (error) {
    console.error('Error loading series data:', error);
    document.getElementById('root').innerHTML = `Error loading configurator data: ${error.message}. Make sure 120-series.md is in the same folder.`;
  }
}

function generateBOM(config) {
  if (!config.type || !config.secCode || !config.gearSize || !config.shaftStyle) return [];
  
  const bom = [];
  
  // Add shaft end cover
  const sec = seriesData.shaftEndCovers.find(sec => sec.code === config.secCode);
  if (sec) {
    bom.push({
      partNumber: sec.partNumber,
      quantity: 1,
      description: `Shaft End Cover - ${sec.description}`
    });
  }

  // Add gear housings
  const gearSizes = [config.gearSize];
  if (config.pumpType !== 'single' && config.additionalGearSizes) {
    gearSizes.push(...config.additionalGearSizes.filter(size => size));
  }
  
  gearSizes.forEach(size => {
    const housing = seriesData.gearHousings.find(h => h.code === size);
    if (housing) {
      bom.push({
        partNumber: housing.partNumber,
        quantity: 1,
        description: `Gear Housing - ${housing.description}`
      });
    }
  });

  // Add drive gear set
  const driveGearKey = `${config.gearSize}-${config.shaftStyle}`;
  const driveGearPartNumber = seriesData.driveGearSets[config.shaftStyle]?.[driveGearKey];
  if (driveGearPartNumber && driveGearPartNumber !== 'N/A') {
    bom.push({
      partNumber: driveGearPartNumber,
      quantity: 1,
      description: `Drive Gear Set - ${config.gearSize}" with ${seriesData.shaftStyles.find(s => s.code === config.shaftStyle)?.description}`
    });
  }

  // Add idler gear sets
  if (config.pumpType !== 'single' && config.additionalGearSizes) {
    config.additionalGearSizes.forEach(size => {
      if (size) {
        const idlerSet = seriesData.idlerGearSets.find(set => set.code === size);
        if (idlerSet) {
          bom.push({
            partNumber: idlerSet.partNumber,
            quantity: 1,
            description: `Idler Gear Set - ${idlerSet.description}`
          });
        }
      }
    });
  }

  // Add PEC Cover
  if (seriesData.pecCover) {
    bom.push({
      partNumber: seriesData.pecCover.partNumber,
      quantity: 1,
      description: `PEC Cover - ${seriesData.pecCover.description}`
    });
  }

  return bom;
}

function generateModelCode(config) {
  if (!config.type || !config.rotation || !config.secCode || !config.gearSize || !config.shaftStyle) return '';
  
  let code = `${config.type}120A${config.rotation}${config.secCode}`;
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

const PumpConfigurator = () => {
  const [config, setConfig] = React.useState({
    type: '',
    series: '120',
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

  React.useEffect(() => {
    setBom(generateBOM(config));
  }, [config]);

  const createEmptyOption = () => React.createElement('option', { value: '' }, '-- Select --');

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
    React.createElement('div', { className: 'px-4 py-5 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-2xl font-bold' }, 'Hydraulic Pump Configurator')
    ),
    React.createElement('div', { className: 'p-4 space-y-6' },
      createSelectField('Type', config.type, 
        [{ value: 'P', label: 'Pump (P)' }, { value: 'M', label: 'Motor (M)' }],
        (value) => setConfig({ ...config, type: value })
      ),
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
      createSelectField('Rotation', config.rotation, seriesData.rotationOptions,
        (value) => setConfig({ ...config, rotation: value })
      ),
      createSelectField('Shaft End Cover', config.secCode, seriesData.shaftEndCovers,
        (value) => setConfig({ ...config, secCode: value })
      ),
      createSelectField('Gear Size', config.gearSize, seriesData.gearHousings,
        (value) => setConfig({ ...config, gearSize: value })
      ),
      createSelectField('Shaft Style', config.shaftStyle, seriesData.shaftStyles,
        (value) => setConfig({ ...config, shaftStyle: value })
      ),
      // Model Code Display
      config.type && React.createElement('div', { className: 'mt-8 p-4 bg-gray-100 rounded' },
        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, 'Model Code:'),
        React.createElement('div', { className: 'font-mono text-lg' }, generateModelCode(config))
      ),
      // BOM Display
      bom.length > 0 && React.createElement('div', { className: 'mt-8 p-4' },
        React.createElement('h3', { className: 'text-lg font-medium mb-4' }, 'Bill of Materials'),
        React.createElement('table', { className: 'w-full text-sm' },
          React.createElement('thead', null,
            React.createElement('tr', { className: 'bg-gray-50' },
              React.createElement('th', { className: 'px-4 py-2 text-left' }, 'Part Number'),
              React.createElement('th', { className: 'px-4 py-2 text-left' }, 'Qty'),
              React.createElement('th', { className: 'px-4 py-2 text-left' }, 'Description')
            )
          ),
          React.createElement('tbody', null,
            bom.map((item, index) =>
              React.createElement('tr', { key: index, className: 'border-t' },
                React.createElement('td', { className: 'px-4 py-2 font-mono' }, item.partNumber),
                React.createElement('td', { className: 'px-4 py-2' }, item.quantity),
                React.createElement('td', { className: 'px-4 py-2' }, item.description)
              )
            )
          )
        )
      )
    )
  );
};

function initializeConfigurator() {
  ReactDOM.render(React.createElement(PumpConfigurator), document.getElementById('root'));
}

window.onload = loadSeriesData;