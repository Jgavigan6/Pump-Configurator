console.log('Loading configurator...');

let seriesData = {};

// Constants
const SERIES_FILES = {
  '20': 'p20-complete-final.md',
  '51': 'p51-complete-final.md',
  '76': 'p76-complete-final.md',
  '120': '120-series.md',
  '131': '131-series.md',
  '151': 'p151-tables.md',
  '176': 'p176-tables.md',
  '215': 'p215-tables.md',
  '315': 'p315-complete-final.md',
  '330': 'p330-complete-final.md',
  '230': 'fgp230-tables.md',
  '250': 'fgp250-tables.md',
  '265': 'fgp265-tables.md',
  '350': 'p350-complete-final.md',
  '365': 'p365-complete-final.md'
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

function validateConfig(config) {
  const errors = [];
  const currentSeriesData = seriesData[config.series];

  // Basic validation
  if (!config.series) {
    return { isValid: false, errors: ['Series must be selected'] };
  }

  // Only validate other fields if series is selected
  if (!currentSeriesData) {
    return { isValid: false, errors: ['No data available for selected series'] };
  }

  const is200Series = ['230', '250', '265'].includes(config.series);
  const is300Series = ['315', '330', '350', '365'].includes(config.series);

  if (config.type) {
    // Get appropriate components based on type and series
    const components = (is200Series || is300Series) && config.type === 'M' ?
      {
        shaftEndCovers: currentSeriesData.motorShaftEndCovers,
        gearHousings: currentSeriesData.motorGearHousings
      } :
      {
        shaftEndCovers: currentSeriesData.shaftEndCovers,
        gearHousings: currentSeriesData.gearHousings
      };

    // Validate required components exist
    if (!components.shaftEndCovers?.length) {
      errors.push('No shaft end covers available');
    }
    if (!components.gearHousings?.length) {
      errors.push('No gear housings available');
    }
    if (!currentSeriesData.shaftStyles?.length) {
      errors.push('No shaft styles available');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function cleanMarkdownContent(content) {
  // Remove any potential non-printable characters and normalize line endings
  return content
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function parseTableSection(section, startIndex = 2) {
  const lines = section.split('\n')
    .filter(line => line.includes('|'))
    .slice(startIndex);

  return lines.map(line => {
    const cells = line.split('|')
      .slice(1, -1)
      .map(cell => cell.trim());
    return cells;
  }).filter(cells => cells.some(cell => cell && cell.toLowerCase() !== 'n/a'));
}

function processSectionContent(section) {
  const sectionTitle = section.split('\n')[0].trim();
  const sectionContent = section.substring(section.indexOf('\n') + 1);
  return { sectionTitle, sectionContent };
}

function validateLoadedData(data, series) {
  const errors = [];

  if (!data.shaftEndCovers?.length && !data.motorShaftEndCovers?.length) {
    errors.push('No shaft end covers found');
  }
  if (!data.gearHousings?.length && !data.motorGearHousings?.length) {
    errors.push('No gear housings found');
  }
  if (!data.shaftStyles?.length) {
    errors.push('No shaft styles found');
  }
  if (Object.keys(data.driveGearSets || {}).length === 0) {
    errors.push('No drive gear sets found');
  }

  if (errors.length > 0) {
    console.warn(`Validation failed for series ${series}:`, errors);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
async function parseMarkdownData(markdownText) {
  console.log('Starting to parse markdown data');
  
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
    rotationOptions: [...DEFAULT_ROTATION_OPTIONS]
  };

  try {
    // Split into sections and filter out empty ones
    const sections = cleanedMarkdown.split('\n## ')
      .map(section => section.trim())
      .filter(Boolean);

    sections.forEach(section => {
      try {
        const { sectionTitle, sectionContent } = processSectionContent(section);
        console.log('Processing section:', sectionTitle);

        // Process Shaft End Covers
        if (sectionTitle.includes('Shaft End Cover (SEC)') || sectionTitle.includes('SEC')) {
          const rows = parseTableSection(sectionContent);
          const parsedData = rows
            .filter(row => row[0] && row[1]) // Ensure code and part number exist
            .map(([code, partNumber, description]) => ({
              code,
              partNumber,
              description: description || 'Standard'
            }));

          if (sectionTitle.toLowerCase().includes('motor')) {
            data.motorShaftEndCovers = parsedData;
            console.log('Added motor shaft end covers:', parsedData.length);
          } else {
            data.shaftEndCovers = parsedData;
            console.log('Added pump shaft end covers:', parsedData.length);
          }
        }

        // Process Gear Housing
        else if (sectionTitle.includes('Gear Housing')) {
          const rows = parseTableSection(sectionContent);
          const parsedData = rows
            .filter(row => row[0] && row[0].match(/^\d+$/)) // Only process rows where first column is a number
            .map(([code, partNumber, description]) => ({
              code,
              partNumber,
              description: description || 'Standard'
            }));

          if (sectionTitle.toLowerCase().includes('motor')) {
            data.motorGearHousings = parsedData;
            console.log('Added motor gear housings:', parsedData.length);
          } else {
            data.gearHousings = parsedData;
            console.log('Added pump gear housings:', parsedData.length);
          }
        }

        // Process Drive Gear Sets
        else if (sectionTitle.includes('Drive Gear Sets') && !sectionTitle.includes('Idler')) {
          const subsections = sectionContent.split('\n### ').filter(Boolean);
          
          subsections.forEach(subsection => {
            const subsectionLines = subsection.split('\n');
            const subsectionTitle = subsectionLines[0].trim();
            
            // Extract style code and description
            let styleCode, styleDesc;
            
            // Try different patterns for style extraction
            const patterns = [
              /Code (\d+).*?\((.*?)\)/,
              /Series Code (\d+).*?\((.*?)\)/,
              /(\d+)\s*\((.*?)\)/
            ];

            for (const pattern of patterns) {
              const match = subsectionTitle.match(pattern);
              if (match) {
                styleCode = match[1];
                styleDesc = match[2];
                break;
              }
            }

            // If no pattern matched, try to extract from the first data row
            if (!styleCode) {
              const rows = parseTableSection(subsection);
              if (rows.length > 0) {
                const codeMatch = rows[0][0].match(/\d+-(\d+)/);
                if (codeMatch) {
                  styleCode = codeMatch[1];
                  styleDesc = subsectionTitle;
                }
              }
            }

            if (styleCode) {
              // Add to shaft styles if not already present
              if (!data.shaftStyles.find(s => s.code === styleCode)) {
                data.shaftStyles.push({ code: styleCode, description: styleDesc });
              }

              // Process gear sets
              if (!data.driveGearSets[styleCode]) {
                data.driveGearSets[styleCode] = {};
              }

              // Look for shaft key
              const shaftKeyMatch = subsection.match(/Shaft Key:\s*([A-Za-z0-9-]+)/);
              if (shaftKeyMatch) {
                data.driveGearSets[styleCode].shaftKey = shaftKeyMatch[1];
              }

              // Add gear sets
              const rows = parseTableSection(subsection);
              rows.forEach(([code, partNumber]) => {
                if (code && partNumber && partNumber.toLowerCase() !== 'n/a') {
                  data.driveGearSets[styleCode][code] = partNumber;
                }
              });

              console.log(`Added drive gear set for style ${styleCode}`);
            }
          });
        }

        // Process other sections...
        // [Previous section processing code remains the same]

      } catch (error) {
        console.error(`Error processing section: ${section.split('\n')[0]}`, error);
      }
    });

    // Validate and log parsed data summary
    console.log('Parsed data summary:', {
      shaftStyles: data.shaftStyles.length,
      shaftEndCovers: data.shaftEndCovers.length,
      gearHousings: data.gearHousings.length,
      driveGearSets: Object.keys(data.driveGearSets).length
    });

    return data;
  } catch (error) {
    console.error('Error parsing markdown data:', error);
    throw error;
  }
}

async function loadSeriesData() {
  try {
    console.log('Starting to load series data...');
    const loadedData = {};
    
    // Load each file sequentially to ensure proper loading
    for (const [series, filename] of Object.entries(SERIES_FILES)) {
      try {
        console.log(`Loading ${filename} for series ${series}...`);
        const response = await fetch(filename);
        
        if (!response.ok) {
          console.error(`Failed to load ${filename}: ${response.statusText}`);
          continue;
        }
        
        const content = await response.text();
        if (!content.trim()) {
          console.error(`Empty content for ${filename}`);
          continue;
        }

        const parsedData = await parseMarkdownData(content);
        const validation = validateLoadedData(parsedData, series);
        
        if (validation.isValid) {
          loadedData[series] = parsedData;
          console.log(`Successfully loaded series ${series}`);
        } else {
          console.warn(`Validation failed for series ${series}:`, validation.errors);
          loadedData[series] = parsedData; // Still load the data even if validation fails
        }
      } catch (error) {
        console.error(`Error loading series ${series}:`, error);
      }
    }

    // Set global series data
    seriesData = loadedData;

    console.log('All series loaded. Available series:', Object.keys(seriesData));
    initializeConfigurator();
  } catch (error) {
    console.error('Error in loadSeriesData:', error);
    document.getElementById('root').innerHTML = `
      <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>Error loading configurator data: ${error.message}</p>
        <p class="mt-2 text-sm">Please check console for details.</p>
      </div>
    `;
  }
}
function generateModelCode(config) {
  try {
    const validation = validateConfig(config);
    if (!validation.isValid) {
      console.warn('Invalid configuration for model code generation:', validation.errors);
      return '';
    }
    
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
  try {
    const validation = validateConfig(config);
    if (!validation.isValid) {
      console.warn('Invalid configuration for BOM generation:', validation.errors);
      return [];
    }

    const currentSeriesData = seriesData[config.series];
    if (!currentSeriesData) {
      console.error('No data found for series:', config.series);
      return [];
    }

    console.log('Generating BOM for config:', config);
    
    const bom = [];
    const is200Series = ['230', '250', '265'].includes(config.series);
    const is300Series = ['315', '330', '350', '365'].includes(config.series);

    // Helper function to add item to BOM
    const addToBOM = (partNumber, quantity, description) => {
      if (partNumber && partNumber.toLowerCase() !== 'n/a') {
        bom.push({ partNumber, quantity, description });
        return true;
      }
      return false;
    };

    // Add shaft end cover
    const secArray = (is200Series || is300Series) && config.type === 'M' ? 
      currentSeriesData.motorShaftEndCovers : 
      currentSeriesData.shaftEndCovers;

    if (!secArray?.length) {
      console.warn(`No shaft end covers found for series ${config.series}, type ${config.type}`);
    }

    const sec = secArray?.find(s => s.code === config.secCode);
    if (sec) {
      addToBOM(sec.partNumber, 1, `Shaft End Cover - ${sec.description}`);
    }

    // Add gear housings
    const gearArray = (is200Series || is300Series) && config.type === 'M' ? 
      currentSeriesData.motorGearHousings : 
      currentSeriesData.gearHousings;

    if (!gearArray?.length) {
      console.warn(`No gear housings found for series ${config.series}, type ${config.type}`);
    }

    const gearSizes = [config.gearSize];
    if (config.pumpType !== 'single' && config.additionalGearSizes) {
      gearSizes.push(...config.additionalGearSizes.filter(Boolean));
    }
    
    gearSizes.forEach((size, index) => {
      const housing = gearArray?.find(h => h.code === size);
      if (housing) {
        addToBOM(
          housing.partNumber,
          1,
          `Gear Housing ${index === 0 ? '(Primary)' : `(Section ${index + 2})`} - ${housing.description}`
        );
      }
    });

    // Add drive gear set and shaft key if needed
    if (currentSeriesData.driveGearSets && config.shaftStyle) {
      const driveGearKey = `${config.gearSize}-${config.shaftStyle}`;
      const driveGearSet = currentSeriesData.driveGearSets[config.shaftStyle];
      const driveGearPartNumber = driveGearSet?.[driveGearKey];

      if (driveGearPartNumber && driveGearPartNumber !== 'N/A') {
        const shaftStyle = currentSeriesData.shaftStyles?.find(s => s.code === config.shaftStyle);
        
        // Add shaft key if specified
        if (driveGearSet.shaftKey) {
          addToBOM(
            driveGearSet.shaftKey,
            1,
            `Shaft Key for ${shaftStyle?.description || ''}`
          );
        }

        addToBOM(
          driveGearPartNumber,
          1,
          `Drive Gear Set - ${config.gearSize}" with ${shaftStyle?.description || ''}`
        );
      }
    }

    // Add idler gear sets for additional sections
    if (config.pumpType !== 'single' && config.additionalGearSizes) {
      config.additionalGearSizes.forEach((size, index) => {
        if (size) {
          const idlerSet = currentSeriesData.idlerGearSets?.find(set => set.code === size);
          if (idlerSet) {
            addToBOM(
              idlerSet.partNumber,
              1,
              `Idler Gear Set (Section ${index + 2}) - ${idlerSet.description || `Size ${size}`}`
            );
          }
        }
      });
    }

    // Add PEC Cover
    if (config.pecSelection) {
      const pecArray = (is200Series || is300Series) && config.type === 'M' ? 
        currentSeriesData.motorPecCovers : 
        currentSeriesData.pecCovers;

      if (!pecArray?.length) {
        console.warn(`No PEC covers found for series ${config.series}, type ${config.type}`);
      }

      const pecCover = pecArray?.find(pec => pec.partNumber === config.pecSelection);
      if (pecCover) {
        addToBOM(
          pecCover.partNumber,
          1,
          `PEC Cover - ${pecCover.description}`
        );
      }
    }

    // Add bearing carrier
    if (config.pumpType !== 'single' && config.bearingCarrierSelection) {
      const qty = determineBearingCarrierQty(config.pumpType);
      const bearingCarrier = currentSeriesData.bearingCarriers?.find(
        bc => bc.partNumber === config.bearingCarrierSelection
      );
      
      if (bearingCarrier && qty > 0) {
        addToBOM(
          bearingCarrier.partNumber,
          qty,
          `Bearing Carrier - ${bearingCarrier.description}${bearingCarrier.commonNumber ? ` (${bearingCarrier.commonNumber})` : ''}`
        );
      }
    }

    // Add fasteners
    const totalGearWidth = calculateTotalGearWidth(config, currentSeriesData);
    const fastenerPartNumber = determineFastenerPartNumber(config, currentSeriesData, totalGearWidth);
    
    if (fastenerPartNumber) {
      const fastenerQty = config.series === '76' ? 8 : 4;
      addToBOM(
        fastenerPartNumber,
        fastenerQty,
        `Fastener${fastenerQty > 4 ? 's' : ''} for ${config.pumpType} unit`
      );
    }

    // Add small parts kit
    if (config.type && config.pumpType) {
      const pumpTypeNumber = {
        'single': '1',
        'tandem': '2',
        'triple': '3',
        'quad': '4'
      }[config.pumpType];
      
      if (pumpTypeNumber) {
        addToBOM(
          `${config.type}${config.series}-${pumpTypeNumber}`,
          1,
          'Small Parts Kit'
        );
      }
    }

    console.log('Generated BOM:', bom);
    return bom;
  } catch (error) {
    console.error('Error generating BOM:', error);
    return [];
  }
}
const PumpConfigurator = () => {
  const initialState = {
    type: '',
    series: '',
    pumpType: '',
    rotation: '',
    secCode: '',
    gearSize: '',
    shaftStyle: '',
    additionalGearSizes: [],
    portingCodes: [''],
    additionalPortingCodes: [],
    pecSelection: '',
    bearingCarrierSelection: ''
  };

  // Main state
  const [config, setConfig] = React.useState(initialState);
  const [bom, setBom] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Effect for BOM generation
  React.useEffect(() => {
    if (Object.keys(config).some(key => config[key])) {
      try {
        const newBom = generateBOM(config);
        setBom(newBom);
        setError(null);
      } catch (error) {
        console.error('Error generating BOM:', error);
        setError('Error generating bill of materials');
      }
    }
  }, [config]);

  // Helper functions
  const createEmptyOption = () => React.createElement(
    'option',
    { value: '', key: 'empty' },
    '-- Select --'
  );

  const getAvailableComponents = (seriesData, type) => {
    if (!seriesData) return {};

    const is200Series = ['230', '250', '265'].includes(config.series);
    const is300Series = ['315', '330', '350', '365'].includes(config.series);

    return (is200Series || is300Series) && type === 'M'
      ? {
          shaftEndCovers: seriesData.motorShaftEndCovers || [],
          gearHousings: seriesData.motorGearHousings || [],
          pecCovers: seriesData.motorPecCovers || [],
          bearingCarriers: seriesData.bearingCarriers || []
        }
      : {
          shaftEndCovers: seriesData.shaftEndCovers || [],
          gearHousings: seriesData.gearHousings || [],
          pecCovers: seriesData.pecCovers || [],
          bearingCarriers: seriesData.bearingCarriers || []
        };
  };

  const createSelectField = (label, value, options, onChange, isPecSelect = false) => {
    if (!Array.isArray(options)) {
      console.warn(`No options provided for ${label}, series ${config.series}`);
      options = [];
    }

    // Filter out invalid options
    const validOptions = options.filter(option => {
      if (isPecSelect) {
        return option && option.partNumber && option.description;
      }
      return option && (option.value || option.code) && (option.label || option.description);
    });

    // Create field ID for labeling
    const fieldId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

    // Log options for debugging
    console.log(`Creating select field for ${label}:`, {
      validOptions: validOptions.length,
      firstOption: validOptions[0]
    });

    return React.createElement('div', { className: 'mb-4' },
      React.createElement('label', {
        htmlFor: fieldId,
        className: 'block text-sm font-medium mb-2 text-gray-700'
      }, label),
      React.createElement('select', {
        id: fieldId,
        className: `w-full p-2 border rounded border-gray-300 
          focus:ring-blue-500 focus:border-blue-500 
          ${validOptions.length === 0 ? 'bg-gray-100' : ''}`,
        value: value || '',
        onChange: (e) => {
          console.log(`${label} changed:`, e.target.value);
          onChange(e.target.value);
        },
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

  const createAdditionalSectionFields = (index) => {
    const currentSeriesData = seriesData[config.series];
    const components = getAvailableComponents(currentSeriesData, config.type);

    return React.createElement('div', {
      key: `section-${index}`,
      className: 'border-t pt-4 mt-4'
    },
      React.createElement('h4', {
        className: 'font-medium mb-4'
      }, `Section ${index + 2}`),
      createSelectField(
        `Gear Size - Section ${index + 2}`,
        config.additionalGearSizes[index] || '',
        components.gearHousings,
        (value) => {
          const newSizes = [...config.additionalGearSizes];
          newSizes[index] = value;
          setConfig({ ...config, additionalGearSizes: newSizes });
        }
      )
    );
  };

  // Handle series change
  const handleSeriesChange = (value) => {
    console.log('Series changed to:', value);
    const newSeriesData = seriesData[value];
    
    if (!newSeriesData) {
      console.error(`No data available for series ${value}`);
      setError(`No data available for series ${value}`);
      return;
    }

    // Validate the series data
    const validation = validateConfig({ series: value });
    if (!validation.isValid) {
      console.warn(`Validation failed for series ${value}:`, validation.errors);
    }
    
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
      bearingCarrierSelection: ''
    });
  };
  // Continue from Part 4...

  // Get current series data and components
  const currentSeriesData = seriesData[config.series];
  const components = currentSeriesData ? getAvailableComponents(currentSeriesData, config.type) : {};

  // Main render
  return React.createElement('div', { className: 'bg-white shadow rounded-lg max-w-4xl mx-auto' },
    // Error Display
    error && React.createElement('div', {
      className: 'p-4 bg-red-50 border-l-4 border-red-400 text-red-700'
    }, error),

    // Header
    React.createElement('div', { className: 'px-4 py-5 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-2xl font-bold text-gray-900' },
        'Hydraulic Pump Configurator'
      )
    ),

    // Loading State
    loading && React.createElement('div', { 
      className: 'p-4 text-center text-gray-500' 
    }, 'Loading...'),

    // Main Form
    React.createElement('div', { className: 'p-4 space-y-6' },
      // Series Selection
      createSelectField(
        'Series',
        config.series,
        [
          { value: '20', label: '20 Series' },
          { value: '51', label: '51 Series' },
          { value: '76', label: '76 Series' },
          { value: '120', label: '120 Series' },
          { value: '131', label: '131 Series' },
          { value: '151', label: '151 Series' },
          { value: '176', label: '176 Series' },
          { value: '215', label: '215 Series' },
          { value: '230', label: '230 Series' },
          { value: '250', label: '250 Series' },
          { value: '265', label: '265 Series' },
          { value: '315', label: '315 Series' },
          { value: '330', label: '330 Series' },
          { value: '350', label: '350 Series' },
          { value: '365', label: '365 Series' }
        ],
        handleSeriesChange
      ),

      // Continue only if series is selected
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

        // Continue only if type is selected
        config.type && React.createElement('div', { className: 'space-y-4' },
          // Pump Type
          createSelectField(
            'Pump Type',
            config.pumpType,
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
                newConfig.bearingCarrierSelection = '';
              } else {
                const count = value === 'tandem' ? 1 : value === 'triple' ? 2 : 3;
                newConfig.additionalGearSizes = Array(count).fill('');
                newConfig.additionalPortingCodes = Array(count).fill('');
              }
              setConfig(newConfig);
            }
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
          currentSeriesData.shaftStyles?.length > 0 && createSelectField(
            'Shaft Style',
            config.shaftStyle,
            currentSeriesData.shaftStyles,
            (value) => setConfig({ ...config, shaftStyle: value })
          ),

          // Additional Sections
          config.pumpType && config.pumpType !== 'single' && React.createElement(
            'div',
            { className: 'border-t pt-4 mt-4' },
            React.createElement('h4', { 
              className: 'font-medium mb-4 text-lg' 
            }, 'Additional Sections'),
            Array.from({
              length: config.pumpType === 'tandem' ? 1 : config.pumpType === 'triple' ? 2 : 3
            }).map((_, index) => createAdditionalSectionFields(index))
          ),

          // Port End Cover
          components.pecCovers?.length > 0 && createSelectField(
            'Port End Cover',
            config.pecSelection,
            components.pecCovers,
            (value) => setConfig({ ...config, pecSelection: value }),
            true
          ),

          // Bearing Carrier
          config.pumpType !== 'single' && components.bearingCarriers?.length > 0 && createSelectField(
            'Bearing Carrier',
            config.bearingCarrierSelection,
            components.bearingCarriers,
            (value) => setConfig({ ...config, bearingCarrierSelection: value }),
            true
          ),

          // Model Code
          React.createElement('div', { className: 'mt-8 p-4 bg-gray-100 rounded' },
            React.createElement('label', { 
              className: 'block text-sm font-medium mb-2' 
            }, 'Model Code:'),
            React.createElement('div', { 
              className: 'font-mono text-lg' 
            }, generateModelCode(config))
          ),

          // BOM Table
          bom.length > 0 && React.createElement('div', { className: 'mt-8 p-4' },
            React.createElement('h3', { 
              className: 'text-lg font-medium mb-4' 
            }, 'Bill of Materials'),
            React.createElement('div', { 
              className: 'overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg' 
            },
              React.createElement('table', { className: 'min-w-full divide-y divide-gray-300' },
                React.createElement('thead', { className: 'bg-gray-50' },
                  React.createElement('tr', null,
                    React.createElement('th', { 
                      className: 'py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900'
                    }, 'Part Number'),
                    React.createElement('th', { 
                      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-900'
                    }, 'Qty'),
                    React.createElement('th', { 
                      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-900'
                    }, 'Description')
                  )
                ),
                React.createElement('tbody', { className: 'divide-y divide-gray-200 bg-white' },
                  bom.map((item, index) =>
                    React.createElement('tr', { key: `bom-${index}` },
                      React.createElement('td', { 
                        className: 'whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900'
                      }, item.partNumber),
                      React.createElement('td', { 
                        className: 'whitespace-nowrap px-3 py-4 text-sm text-gray-500'
                      }, item.quantity),
                      React.createElement('td', { 
                        className: 'whitespace-normal px-3 py-4 text-sm text-gray-500'
                      }, item.description)
                    )
                  )
                )
              )
            ),
            React.createElement('div', { className: 'mt-4 flex justify-end' },
              React.createElement('button', {
                className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
                onClick: () => {
                  const rows = bom.map(item => `${item.partNumber}\t${item.quantity}`).join('\n');
                  navigator.clipboard.writeText(rows);
                }
              }, 'Copy Part Numbers and Quantity')
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