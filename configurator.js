console.log('Loading configurator...');

let seriesData = {};
const DEBUG = true;

function debugLog(context, data, type = 'info') {
  if (!DEBUG) return;
  console[type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log'](`[${context}]:`, data);
}

const SERIES_FILES = {
  '20': '20.md',
  '51': '51.md', 
  '76': '76.md',
  '120': '120.md',
  '131': '131.md',
  '151': '151.md',
  '176': '176.md', 
  '215': '215.md',
  '230': '230.md',
  '250': '250.md',
  '265': '265.md',
  '315': '315.md',
  '330': '330.md',
  '350': '350.md',
  '365': '365.md'
};

const DEFAULT_ROTATION_OPTIONS = [
  { code: '1', description: 'CW' },
  { code: '2', description: 'CCW' },
  { code: '3', description: 'Bi rotational' },
  { code: '4', description: 'CW with bearing' },
  { code: '5', description: 'CCW with bearing' },
  { code: '6', description: 'Bi rotational with bearing' },
  { code: '8', description: 'Birotational motor with 1-1/4" NPT case drain with bearing' },
  { code: '9', description: 'Birotational motor with 1-1/4" NPT case drain without bearing' }
];

async function loadSeriesData() {
  try {
    console.log('Starting to load series data...');
    const loadedData = {};
    
    for (const [series, filename] of Object.entries(SERIES_FILES)) {
      try {
        console.log(`Attempting to load ${filename} for series ${series}`);
        
        const response = await fetch(filename);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        
        if (!content || !content.trim()) {
          throw new Error(`Empty content for ${filename}`);
        }

        const parsedData = parseMarkdownData(content);
        console.log(`Successfully parsed data for series ${series}`);
        loadedData[series] = parsedData;

      } catch (error) {
        console.error(`Failed to process ${filename}:`, error);
      }
    }

    if (Object.keys(loadedData).length === 0) {
      throw new Error('No series data could be loaded');
    }

    seriesData = loadedData;
    console.log(`Successfully loaded ${Object.keys(loadedData).length} series`);
    initializeConfigurator();

  } catch (error) {
    console.error('Error in loadSeriesData:', error);
    document.getElementById('root').innerHTML = `
      <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <h3 class="font-bold mb-2">Error loading configurator data:</h3>
        <p>Error: ${error.message}</p>
        <p class="mt-2">Please ensure all files are accessible:</p>
        <ul class="mt-1 text-sm list-disc list-inside">
          ${Object.values(SERIES_FILES).map(f => `<li>${f}</li>`).join('\n')}
        </ul>
        <p class="mt-2 text-sm">Check console for detailed error messages.</p>
      </div>
    `;
  }
}

// Clean and standardize markdown content
function cleanMarkdownContent(content) {
  if (!content) return '';
  return content.toString()
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

// Extract section content by heading
function findSectionContent(text, sectionName) {
  if (!text || !sectionName) return '';
  const pattern = new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
  const match = text.match(pattern);
  return match ? match[0].trim() : '';
}
// Parse table data from markdown section
function parseTableData(section) {
  if (!section) return [];

  try {
    const lines = section.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.includes('|'));

    if (lines.length < 3) return []; // Need header, separator, and data

    return lines.slice(2) // Skip header and separator
      .map(line => {
        const cells = line.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell);
        return cells.length >= 2 ? cells : null;
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Error parsing table data:', error);
    return [];
  }
}

// Find drive gear sections
function findDriveGearSections(content) {
  if (!content) return [];
  const mainPattern = /### Code \d+[^#]*?(?=###|$)/gs;
  return (content.match(mainPattern) || []).map(section => section.trim());
}

// Process gear sections from markdown
function processGearSections(markdown) {
  const driveGearSets = {};
  const shaftStyles = [];
  const driveGearSection = findSectionContent(markdown, 'Drive Gear Sets');
  
  if (driveGearSection) {
    const subSections = findDriveGearSections(driveGearSection);
    subSections.forEach(section => {
      const titleMatch = section.match(/### Code (\d+)\s*\((.*?)\)/);
      if (titleMatch) {
        const [_, code, description] = titleMatch;
        
        if (!driveGearSets[code]) {
          driveGearSets[code] = {};
        }
        
        if (!shaftStyles.find(s => s.code === code)) {
          shaftStyles.push({ code, description: description.trim() });
        }

        const shaftKeyMatch = section.match(/Shaft Key:\s*([\w-]+)/);
        if (shaftKeyMatch) {
          driveGearSets[code].shaftKey = shaftKeyMatch[1];
        }

        parseTableData(section).forEach(([gearCode, partNumber]) => {
          if (gearCode && partNumber && partNumber.toLowerCase() !== 'n/a') {
            const gearMatch = gearCode.match(/^(\d+)(?:-\d+)?$/);
            if (gearMatch) {
              const gearSize = gearMatch[1];
              driveGearSets[code][`${gearSize}-${code}`] = partNumber;
            }
          }
        });
      }
    });
  }

  return { driveGearSets, shaftStyles };
}

// Parse bearing carriers section
function parseBearingCarriers(section) {
  if (!section) return [];
  const tableData = parseTableData(section);
  return tableData.map(([description, partNumber, commonNumber]) => ({
    description: description.trim(),
    partNumber: partNumber.trim(),
    commonNumber: commonNumber ? commonNumber.replace(/[()]/g, '').trim() : ''
  })).filter(item => item.partNumber);
}

// Parse all markdown data into structured format
function parseMarkdownData(markdownText) {
  const cleanedMarkdown = cleanMarkdownContent(markdownText);
  
  const data = {
    shaftEndCovers: [],
    gearHousings: [],
    pecCovers: [],
    motorShaftEndCovers: [],
    motorGearHousings: [],
    motorPecCovers: [],
    driveGearSets: {},
    idlerGearSets: [],
    bearingCarriers: [],
    fastenersSingle: [],
    fastenersDoubles: [],
    fastenersTripleQuad: [],
    shaftStyles: [],
    motorFastenersSingle: [],
    rotationOptions: [...DEFAULT_ROTATION_OPTIONS]
  };

  // Process shaft end covers
  const pumpSecContent = findSectionContent(cleanedMarkdown, 'Shaft End Cover \\(SEC\\) - Pumps') || 
                        findSectionContent(cleanedMarkdown, 'Shaft End Cover \\(SEC\\)');
  if (pumpSecContent) {
    data.shaftEndCovers = parseTableData(pumpSecContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);
  }

  // Process motor shaft end covers
  const motorSecContent = findSectionContent(cleanedMarkdown, 'Shaft End Cover \\(SEC\\) - Motors');
  if (motorSecContent) {
    data.motorShaftEndCovers = parseTableData(motorSecContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);
  }

  // Process PEC covers
  const pecContent = findSectionContent(cleanedMarkdown, 'P\\.E\\.C Cover') || 
                    findSectionContent(cleanedMarkdown, 'Port End Covers');
  if (pecContent) {
    const sections = pecContent.split(/##/);
    let allPecCovers = [];
    
    sections.forEach(section => {
      const tableData = parseTableData(section);
      const covers = tableData
        .map(([description, partNumber]) => ({
          description: description.trim(),
          partNumber: partNumber.trim()
        }))
        .filter(item => item.partNumber && item.description);
      allPecCovers.push(...covers);
    });

    data.pecCovers = allPecCovers;
  }

  // Process gear housings
  const gearContent = findSectionContent(cleanedMarkdown, 'Gear Housing') ||
                     findSectionContent(cleanedMarkdown, 'Gear Housing - Pumps');
  if (gearContent) {
    data.gearHousings = parseTableData(gearContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);
  }

  // Process drive gear sets
  const { driveGearSets, shaftStyles } = processGearSections(cleanedMarkdown);
  data.driveGearSets = driveGearSets;
  data.shaftStyles = shaftStyles;

  // Process idler gear sets
  const idlerSection = findSectionContent(cleanedMarkdown, 'Idler Gear Sets');
  if (idlerSection) {
    data.idlerGearSets = parseTableData(idlerSection)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);
  }

  // Process bearing carriers
  const bearingSection = findSectionContent(cleanedMarkdown, 'Bearing Carriers');
  if (bearingSection) {
    data.bearingCarriers = parseBearingCarriers(bearingSection);
  }

  // Process fasteners
  const singleFasteners = findSectionContent(cleanedMarkdown, 'Fasteners - Single Units');
  if (singleFasteners) {
    data.fastenersSingle = parseTableData(singleFasteners)
      .map(([code, partNumber]) => ({
        code,
        partNumber
      }))
      .filter(item => item.partNumber);
  }

  return data;
}
// Calculate total gear width
function calculateTotalGearWidth(config, currentSeriesData) {
  if (!currentSeriesData?.gearHousings || !config.gearSize) return 0;

  let totalWidth = 0;
  const extractWidth = (description) => {
    if (!description) return null;
    // Handle various dimension formats
    const match = description.match(/(\d+(?:\/\d+)?|\d+(?:-\d+\/\d+)?)"?[-\s]/);
    if (match) {
      const fraction = match[1].replace('-', ' ');
      try {
        return Function(`'use strict'; return (${fraction})`)();
      } catch (e) {
        console.error('Error evaluating width:', e);
        return null;
      }
    }
    return null;
  };

  const primaryGear = currentSeriesData.gearHousings.find(h => h.code === config.gearSize);
  if (primaryGear) {
    const width = extractWidth(primaryGear.description);
    if (width !== null) totalWidth += width;
  }

  if (config.additionalGearSizes) {
    config.additionalGearSizes.forEach(size => {
      if (!size) return;
      const gear = currentSeriesData.gearHousings.find(h => h.code === size);
      if (gear) {
        const width = extractWidth(gear.description);
        if (width !== null) totalWidth += width;
      }
    });
  }

  return totalWidth;
}

function determineBearingCarrierQty(pumpType) {
  const qtyMap = {
    'single': 0,
    'tandem': 1,
    'double': 1,
    'triple': 2,
    'quad': 3
  };
  return qtyMap[pumpType?.toLowerCase()] || 0;
}

function determineFastenerPartNumber(config, currentSeriesData, totalGearWidth) {
  if (!currentSeriesData || !config.gearSize) return null;

  const fastenerArray = config.type === 'M' && currentSeriesData.motorFastenersSingle?.length > 0
    ? currentSeriesData.motorFastenersSingle
    : currentSeriesData.fastenersSingle;

  if (config.pumpType === 'single') {
    return fastenerArray?.find(f => f.code === config.gearSize)?.partNumber;
  }

  const fastenersMulti = config.pumpType === 'tandem' ? 
    currentSeriesData.fastenersDoubles : 
    currentSeriesData.fastenersTripleQuad;

  if (!fastenersMulti?.length) return null;

  return fastenersMulti.find(f => {
    const widthMatch = f.condition.match(/(\d+(?:\.\d+)?)/);
    if (!widthMatch) return false;
    const widthLimit = parseFloat(widthMatch[1]);
    return f.condition.includes('less than') ? 
      totalGearWidth < widthLimit : 
      totalGearWidth >= widthLimit;
  })?.partNumber;
}

function generateModelCode(config) {
  if (!config.type || !config.series || !config.rotation || 
      !config.secCode || !config.gearSize || !config.shaftStyle) {
    return '';
  }

  try {
    let code = `${config.type}${config.series}A${config.rotation}${config.secCode}`;
    code += config.portingCodes[0] || 'XXXX';
    code += `${config.gearSize}-${config.shaftStyle}`;
    
    if (config.pumpType !== 'single' && config.additionalGearSizes?.length > 0) {
      config.additionalGearSizes.forEach((size, index) => {
        if (size) {
          code += (config.additionalPortingCodes[index] || 'XXXX');
          code += `${size}-${index + 1}`;
        }
      });
    }
    
    return code;
  } catch (error) {
    console.error('Error generating model code:', error);
    return '';
  }
}

function generateBOM(config) {
  const currentSeriesData = seriesData[config.series];
  if (!currentSeriesData || !config.type) return [];

  const bom = [];
  const is200Series = ['230', '250', '265'].includes(config.series);
  const is300Series = ['315', '330', '350', '365'].includes(config.series);

  try {
    const addToBOM = (partNumber, quantity, description) => {
      if (partNumber && partNumber.toLowerCase() !== 'n/a') {
        bom.push({ partNumber, quantity, description });
        return true;
      }
      return false;
    };

    // Get appropriate component set
    const components = (is200Series || is300Series) && config.type === 'M' ?
      {
        shaftEndCovers: currentSeriesData.motorShaftEndCovers,
        gearHousings: currentSeriesData.motorGearHousings,
        pecCovers: currentSeriesData.motorPecCovers,
        fasteners: currentSeriesData.motorFastenersSingle
      } :
      {
        shaftEndCovers: currentSeriesData.shaftEndCovers,
        gearHousings: currentSeriesData.gearHousings,
        pecCovers: currentSeriesData.pecCovers,
        fasteners: currentSeriesData.fastenersSingle
      };

    // Add shaft end cover
    if (config.secCode) {
      const sec = components.shaftEndCovers?.find(s => s.code === config.secCode);
      if (sec) {
        addToBOM(sec.partNumber, 1, `Shaft End Cover - ${sec.description}`);
      }
    }

    // Add gear housings
    if (config.gearSize) {
      const gearSizes = [config.gearSize];
      if (config.pumpType !== 'single' && config.additionalGearSizes) {
        gearSizes.push(...config.additionalGearSizes.filter(Boolean));
      }
      
      gearSizes.forEach((size, index) => {
        const housing = components.gearHousings?.find(h => h.code === size);
        if (housing) {
          addToBOM(housing.partNumber, 1,
            `Gear Housing ${index === 0 ? '(Primary)' : `(Section ${index + 2})`} - ${housing.description}`);
        }
      });
    }

    // Add drive gear set and shaft key
    if (config.shaftStyle && config.gearSize) {
      const driveGearSet = currentSeriesData.driveGearSets[config.shaftStyle];
      
      if (driveGearSet) {
        if (driveGearSet.shaftKey) {
          const shaftStyle = currentSeriesData.shaftStyles?.find(s => s.code === config.shaftStyle);
          addToBOM(driveGearSet.shaftKey, 1, 
            `Shaft Key for ${shaftStyle?.description || config.shaftStyle}`);
        }

        const driveGearKey = `${config.gearSize}-${config.shaftStyle}`;
        const driveGearPartNumber = driveGearSet[driveGearKey];
        if (driveGearPartNumber) {
          const shaftStyle = currentSeriesData.shaftStyles?.find(s => s.code === config.shaftStyle);
          addToBOM(driveGearPartNumber, 1,
            `Drive Gear Set - ${config.gearSize}" with ${shaftStyle?.description || config.shaftStyle}`);
        }
      }
    }

    // Add idler gear sets for multi-section units
    if (config.pumpType !== 'single' && config.additionalGearSizes) {
      config.additionalGearSizes.forEach((size, index) => {
        if (size) {
          const idlerSet = currentSeriesData.idlerGearSets?.find(set => set.code === size);
          if (idlerSet) {
            addToBOM(idlerSet.partNumber, 1,
              `Idler Gear Set (Section ${index + 2}) - ${idlerSet.description || `Size ${size}`}`);
          }
        }
      });
    }

    // Add PEC Cover
    if (config.pecSelection) {
      const pecCover = components.pecCovers?.find(pec => pec.partNumber === config.pecSelection);
      if (pecCover) {
        addToBOM(pecCover.partNumber, 1, `PEC Cover - ${pecCover.description}`);
      }
    }

    // Add bearing carrier for multi-section units
    if (['tandem', 'triple', 'quad'].includes(config.pumpType) && config.bearingCarrierSelections) {
      config.bearingCarrierSelections.forEach((selection, index) => {
        if (selection) {
          const bearingCarrier = currentSeriesData.bearingCarriers?.find(
            bc => bc.partNumber === selection
          );
          
          if (bearingCarrier) {
            addToBOM(bearingCarrier.partNumber, 1,
              `Bearing Carrier (Section ${index + 2}) - ${bearingCarrier.description}`);
          }
        }
      });
    }

    // Add fasteners
    if (config.gearSize) {
      const totalGearWidth = calculateTotalGearWidth(config, currentSeriesData);
      const fastenerPartNumber = determineFastenerPartNumber(config, currentSeriesData, totalGearWidth);
      
      if (fastenerPartNumber) {
        const fastenerQty = config.series === '76' ? 8 : 4;
        addToBOM(fastenerPartNumber, fastenerQty,
          `Fastener${fastenerQty > 4 ? 's' : ''} for ${config.pumpType || 'single'} unit`);
      }
    }

    // Add small parts kit
    if (config.type && config.pumpType && config.series) {
      const pumpTypeNumber = {
        'single': '1',
        'tandem': '2',
        'triple': '3',
        'quad': '4'
      }[config.pumpType];
      
      if (pumpTypeNumber) {
        const smallPartsKit = `${config.type}${config.series}-${pumpTypeNumber}`;
        addToBOM(smallPartsKit, 1, 'Small Parts Kit');
      }
    }

  } catch (error) {
    console.error('Error generating BOM:', error);
  }

  return bom;
}
// Main React Component
const PumpConfigurator = () => {
  const initialState = {
    series: '',
    type: '',
    pumpType: 'single',
    rotation: '',
    secCode: '',
    gearSize: '',
    shaftStyle: '',
    pecSelection: '',
    bearingCarrierSelections: [], // Array for multiple bearing carriers
    portingCodes: [''],
    additionalGearSizes: [],
    additionalPortingCodes: []
  };

  const [config, setConfig] = React.useState(initialState);
  const [bom, setBom] = React.useState([]);
  const [error, setError] = React.useState(null);

  // Update BOM when configuration changes
  React.useEffect(() => {
    if (config.type && config.series) {
      try {
        const newBom = generateBOM(config);
        setBom(newBom);
        setError(null);
      } catch (error) {
        console.error('Error generating BOM:', error);
        setError('Error generating bill of materials');
      }
    } else {
      setBom([]);
    }
  }, [config]);

  // Get available components
  const getAvailableComponents = (seriesData, type) => {
    if (!seriesData) return {};

    const isMotor = type === 'M';
    console.log(`Getting components for ${isMotor ? 'motor' : 'pump'} type`);

    return {
      shaftEndCovers: isMotor ? seriesData.motorShaftEndCovers || [] : seriesData.shaftEndCovers || [],
      gearHousings: isMotor ? seriesData.motorGearHousings || [] : seriesData.gearHousings || [],
      pecCovers: isMotor ? seriesData.motorPecCovers || [] : seriesData.pecCovers || [],
      bearingCarriers: seriesData.bearingCarriers || [],
      shaftStyles: seriesData.shaftStyles || []
    };
  };

  // Create empty option
  const createEmptyOption = () => React.createElement(
    'option',
    { value: '', key: 'empty' },
    '-- Select --'
  );

  // Create select field
  const createSelectField = (label, value, options, onChange, isPecSelect = false) => {
    if (!Array.isArray(options)) {
      console.warn(`No options provided for ${label}`);
      options = [];
    }

    const validOptions = options.filter(option => {
      if (isPecSelect) {
        return option && option.partNumber && option.description;
      }
      return option && (option.value || option.code) && (option.label || option.description);
    });

    const fieldId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return React.createElement('div', { className: 'mb-4' },
      React.createElement('label', {
        htmlFor: fieldId,
        className: 'block text-sm font-medium mb-2 text-gray-700'
      }, label),
      React.createElement('select', {
        id: fieldId,
        className: `w-full p-2 border rounded ${validOptions.length === 0 ? 'bg-gray-100' : ''} 
          border-gray-300 focus:ring-blue-500 focus:border-blue-500`,
        value: value || '',
        onChange: (e) => onChange(e.target.value),
        disabled: validOptions.length === 0
      }, [
        createEmptyOption(),
        ...validOptions.map(option => {
          const optionValue = isPecSelect ? option.partNumber : (option.value || option.code);
          const optionLabel = isPecSelect ? 
            option.description :
            option.label || (option.code ? `${option.code} - ${option.description}` : option.description);
          
          return React.createElement('option', {
            value: optionValue || '',
            key: `${fieldId}-${optionValue}`
          }, optionLabel || '');
        })
      ])
    );
  };

  // Handle series change
  const handleSeriesChange = (value) => {
    console.log('Series changed to:', value);
    setConfig({
      ...initialState,
      series: value
    });
    setError(null);
  };

  // Handle type change
  const handleTypeChange = (value) => {
    console.log('Type changed to:', value);
    setConfig({
      ...config,
      type: value,
      secCode: '',
      gearSize: '',
      shaftStyle: '',
      pecSelection: '',
      bearingCarrierSelections: []
    });
  };

  // Handle pump type change
  const handlePumpTypeChange = (value) => {
    const newConfig = { ...config, pumpType: value };
    if (value === 'single') {
      newConfig.additionalGearSizes = [];
      newConfig.additionalPortingCodes = [];
      newConfig.bearingCarrierSelections = [];
    } else {
      const count = value === 'tandem' ? 1 : value === 'triple' ? 2 : 3;
      newConfig.additionalGearSizes = Array(count).fill('');
      newConfig.additionalPortingCodes = Array(count).fill('');
      newConfig.bearingCarrierSelections = Array(count).fill('');
    }
    setConfig(newConfig);
  };

  // Handle bearing carrier selection
  const handleBearingCarrierChange = (value, index) => {
    const newSelections = [...config.bearingCarrierSelections];
    newSelections[index] = value;
    setConfig({ ...config, bearingCarrierSelections: newSelections });
  };

  const currentSeriesData = seriesData[config.series];
  const components = currentSeriesData ? getAvailableComponents(currentSeriesData, config.type) : {};

  // Main render
  return React.createElement('div', { className: 'bg-white shadow rounded-lg max-w-4xl mx-auto p-4' },
    error && React.createElement('div', {
      className: 'p-4 mb-4 bg-red-50 border-l-4 border-red-400 text-red-700'
    }, error),

    React.createElement('div', { className: 'mb-6' },
      React.createElement('h1', { 
        className: 'text-2xl font-bold text-gray-900'
      }, 'Hydraulic Pump Configurator')
    ),

    React.createElement('form', { className: 'space-y-6' },
      // Series Selection
      createSelectField(
        'Series',
        config.series,
        Object.keys(SERIES_FILES).map(series => ({
          value: series,
          label: `${series} Series`
        })),
        handleSeriesChange
      ),

      config.series && currentSeriesData && React.createElement('div', { className: 'space-y-4' },
        // Type Selection
        createSelectField(
          'Type',
          config.type,
          [
            { value: 'P', label: 'Pump (P)' },
            { value: 'M', label: 'Motor (M)' }
          ],
          handleTypeChange
        ),

        config.type && React.createElement('div', { className: 'space-y-4' },
          // Configuration fields
          createSelectField(
            'Configuration',
            config.pumpType,
            [
              { value: 'single', label: 'Single' },
              { value: 'tandem', label: 'Tandem' },
              { value: 'triple', label: 'Triple' },
              { value: 'quad', label: 'Quad' }
            ],
            handlePumpTypeChange
          ),

          // Rotation
          createSelectField(
            'Rotation',
            config.rotation,
            currentSeriesData.rotationOptions || [],
            (value) => setConfig({ ...config, rotation: value })
          ),

          // Shaft End Cover
          components.shaftEndCovers?.length > 0 && createSelectField(
            'Shaft End Cover',
            config.secCode,
            components.shaftEndCovers,
            (value) => setConfig({ ...config, secCode: value })
          ),

          // Gear Size
          components.gearHousings?.length > 0 && createSelectField(
            'Gear Size',
            config.gearSize,
            components.gearHousings,
            (value) => setConfig({ ...config, gearSize: value })
          ),

          // Shaft Style
          components.shaftStyles?.length > 0 && createSelectField(
            'Shaft Style',
            config.shaftStyle,
            components.shaftStyles,
            (value) => setConfig({ ...config, shaftStyle: value })
          ),

          // Port End Cover
          components.pecCovers?.length > 0 && createSelectField(
            'Port End Cover',
            config.pecSelection,
            components.pecCovers,
            (value) => setConfig({ ...config, pecSelection: value }),
            true
          ),

          // Additional sections for multi-section units
          config.pumpType !== 'single' && config.additionalGearSizes?.map((size, index) => 
            React.createElement('div', { 
              key: `section-${index + 2}`,
              className: 'mt-4 p-4 bg-gray-50 rounded'
            },
              React.createElement('h3', { className: 'text-lg font-medium mb-4' },
                `Section ${index + 2} Configuration`
              ),
              createSelectField(
                `Gear Size - Section ${index + 2}`,
                size,
                components.gearHousings,
                (value) => {
                  const newSizes = [...config.additionalGearSizes];
                  newSizes[index] = value;
                  setConfig({ ...config, additionalGearSizes: newSizes });
                }
              ),
              // Add bearing carrier selection for each additional section
              components.bearingCarriers?.length > 0 && createSelectField(
                `Bearing Carrier - Section ${index + 2}`,
                config.bearingCarrierSelections[index] || '',
                components.bearingCarriers,
                (value) => handleBearingCarrierChange(value, index),
                true
              )
            )
          ),

          // Model Code Display
          React.createElement('div', { className: 'mt-8 p-4 bg-gray-100 rounded' },
            React.createElement('h4', { className: 'text-sm font-medium mb-2' },
              'Model Code:'
            ),
            React.createElement('div', { className: 'font-mono text-lg' },
              generateModelCode(config)
            )
          ),

          // BOM Table
          bom.length > 0 && React.createElement('div', { className: 'mt-8' },
            React.createElement('h4', { className: 'text-lg font-medium mb-4' },
              'Bill of Materials'
            ),
            React.createElement('div', { className: 'overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg' },
              React.createElement('table', { className: 'min-w-full divide-y divide-gray-300' },
                React.createElement('thead', { className: 'bg-gray-50' },
                  React.createElement('tr', null,
                    React.createElement('th', { className: 'py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900' },
                      'Part Number'
                    ),
                    React.createElement('th', { className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-900' },
                      'Qty'
                    ),
                    React.createElement('th', { className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-900' },
                      'Description'
                    )
                  )
                ),
                React.createElement('tbody', { className: 'divide-y divide-gray-200 bg-white' },
                  bom.map((item, index) =>
                    React.createElement('tr', { key: `bom-${index}` },
                      React.createElement('td', { className: 'whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900' },
                        item.partNumber
                      ),
                      React.createElement('td', { className: 'whitespace-nowrap px-3 py-4 text-sm text-gray-500' },
                        item.quantity
                      ),
                      React.createElement('td', { className: 'whitespace-normal px-3 py-4 text-sm text-gray-500' },
                        item.description
                      )
                    )
                  )
                )
              )
            ),
            React.createElement('div', { className: 'mt-4 flex justify-end' },
              React.createElement('button', {
                className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                onClick: (e) => {
                  e.preventDefault();
                  const rows = bom.map(item => `${item.partNumber}\t${item.quantity}`).join('\n');
                  navigator.clipboard.writeText(rows);
                }
              }, 'Copy Part Numbers and Quantities')
            )
          )
        )
      )
    )
  );
};

// Initialize configurator
function initializeConfigurator() {
  ReactDOM.render(
    React.createElement(PumpConfigurator),
    document.getElementById('root')
  );
}

// Start loading on page load
window.addEventListener('load', () => {
  console.log('Window loaded, starting configurator initialization...');
  loadSeriesData();
});
