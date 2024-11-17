console.log('Loading configurator...');

let seriesData = {};

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

async function loadSeriesData() {
  try {
    // Load both series files
    const [response120, response151] = await Promise.all([
      fetch('120-series.md'),
      fetch('p151-tables.md')
    ]);

    if (!response120.ok || !response151.ok) {
      throw new Error('Failed to load one or more series files');
    }

    const [content120, content151] = await Promise.all([
      response120.text(),
      response151.text()
    ]);

    // Parse both series
    seriesData = {
      '120': await parseMarkdownData(content120),
      '151': await parseMarkdownData(content151)
    };

    initializeConfigurator();
  } catch (error) {
    console.error('Error loading series data:', error);
    document.getElementById('root').innerHTML = `Error loading configurator data: ${error.message}. 
      Make sure both 120-series.md and p151-tables.md are in the same folder.`;
  }
}
function generateBOM(config) {
  if (!config.type || !config.series || !config.secCode || !config.gearSize || !config.shaftStyle) return [];
  
  const currentSeriesData = seriesData[config.series] || {};
  const bom = [];
  
  // Add shaft end cover
  const sec = currentSeriesData.shaftEndCovers.find(sec => sec.code === config.secCode);
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
    const housing = currentSeriesData.gearHousings.find(h => h.code === size);
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
  const driveGearPartNumber = currentSeriesData.driveGearSets[config.shaftStyle]?.[driveGearKey];
  if (driveGearPartNumber && driveGearPartNumber !== 'N/A') {
    bom.push({
      partNumber: driveGearPartNumber,
      quantity: 1,
      description: `Drive Gear Set - ${config.gearSize}" with ${currentSeriesData.shaftStyles.find(s => s.code === config.shaftStyle)?.description}`
    });
  }

  // Add idler gear sets
  if (config.pumpType !== 'single' && config.additionalGearSizes) {
    config.additionalGearSizes.forEach(size => {
      if (size) {
        const idlerSet = currentSeriesData.idlerGearSets.find(set => set.code === size);
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
  if (currentSeriesData.pecCover) {
    bom.push({
      partNumber: currentSeriesData.pecCover.partNumber,
      quantity: 1,
      description: `PEC Cover - ${currentSeriesData.pecCover.description}`
    });
  }

  // Add small parts kit
  if (config.type && config.pumpType) {
    const pumpTypeNumber = 
      config.pumpType === 'single' ? '1' :
      config.pumpType === 'tandem' ? '2' :
      config.pumpType === 'triple' ? '3' : '4';
    
    bom.push({
      partNumber: `${config.type}${config.series}-${pumpTypeNumber}`,
      quantity: 1,
      description: 'Small Parts Kit'
    });
  }

  return bom;
}

function generateModelCode(config) {
  if (!config.type || !config.series || !config.rotation || !config.secCode || !config.gearSize || !config.shaftStyle) return '';
  
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

  const currentSeriesData = seriesData[config.series] || {};

  return React.createElement('div', { className: 'bg-white shadow rounded-lg max-w-4xl mx-auto' },
    React.createElement('div', { className: 'px-4 py-5 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-2xl font-bold' }, 'Hydraulic Pump Configurator')
    ),
    React.createElement('div', { className: 'p-4 space-y-6' },
      // Series Selection
      createSelectField('Series', config.series,
        [
          { value: '120', label: '120 Series' },
          { value: '151', label: '151 Series' }
        ],
        (value) => {
          setConfig({
            ...config,
            series: value,
            secCode: '',
            gearSize: '',
            shaftStyle: '',
            additionalGearSizes: [],
            portingCodes: [''],
            additionalPortingCodes: []
          });
        }
      ),

      // Only show other fields if series is selected
      config.series && React.createElement('div', { className: 'space-y-4' },
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
        createSelectField('Rotation', config.rotation, currentSeriesData.rotationOptions || [],
          (value) => setConfig({ ...config, rotation: value })
        ),
        createSelectField('Shaft End Cover', config.secCode, currentSeriesData.shaftEndCovers || [],
          (value) => setConfig({ ...config, secCode: value })
        ),
        createSelectField('Gear Size', config.gearSize, currentSeriesData.gearHousings || [],
          (value) => setConfig({ ...config, gearSize: value })
        ),
        createSelectField('Shaft Style', config.shaftStyle, currentSeriesData.shaftStyles || [],
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
          React.createElement('div', { className: 'table-container' },
            React.createElement('table', { className: 'bom-table' },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', null, 'Part Number'),
                  React.createElement('th', null, 'Qty'),
                  React.createElement('th', null, 'Description')
                )
              ),
              React.createElement('tbody', null,
                bom.map((item, index) =>
                  React.createElement('tr', { key: index },
                    React.createElement('td', { className: 'selectable-cell', tabIndex: 0 }, item.partNumber),
                    React.createElement('td', { className: 'selectable-cell', tabIndex: 0 }, item.quantity),
                    React.createElement('td', { className: 'selectable-cell', tabIndex: 0 }, item.description)
                  )
                )
              )
            )
          ),
          React.createElement('div', { className: 'mt-4 flex gap-2' },
            React.createElement('button', {
              className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
              onClick: () => {
                const parts = bom.map(item => item.partNumber).join('\n');
                navigator.clipboard.writeText(parts);
              }
            }, 'Copy Part Numbers'),
            React.createElement('button', {
              className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
              onClick: () => {
                const text = bom.map(item => `${item.partNumber}\t${item.quantity}\t${item.description}`).join('\n');
                navigator.clipboard.writeText(text);
              }
            }, 'Copy All')
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