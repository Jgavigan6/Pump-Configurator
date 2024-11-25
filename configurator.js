console.log('Loading configurator...');

let seriesData = {};

const SERIES_FILES = {
  '20': 'p20-complete-final.md',
  '51': 'p51-complete-final.md',
  '76': 'p76-complete-final.md',
  '120': '120-series.md',
  '131': '131-series.md',
  '151': 'p151-tables.md',
  '176': 'p176-tables.md',
  '215': 'p215-tables.md',
  '230': 'fgp230-tables.md',
  '250': 'fgp250-tables.md',
  '265': 'fgp265-tables.md',
  '315': 'p315-complete-final.md',
  '330': 'p330-complete-final.md',
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

function cleanMarkdownContent(content) {
  return content
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function findSectionContent(text, sectionTitle, includeSubsections = false) {
  if (!text || !sectionTitle) return '';
  
  const sections = text.split(/(?=#{1,3}\s)/);
  const matchingSection = sections.find(section => {
    const firstLine = section.split('\n')[0];
    return firstLine.toLowerCase().includes(sectionTitle.toLowerCase());
  });

  if (!matchingSection) return '';

  if (includeSubsections) {
    return matchingSection;
  }

  // Only return the content up to the next section of the same or higher level
  const lines = matchingSection.split('\n');
  const headerLevel = (lines[0].match(/^#+/) || ['#'])[0].length;
  const contentLines = [lines[0]];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(new RegExp(`^#{1,${headerLevel}}`))) break;
    contentLines.push(lines[i]);
  }

  return contentLines.join('\n').trim();
}

function parseTableData(section) {
  if (!section) return [];
  
  const lines = section.split('\n').filter(line => line.trim() && line.includes('|'));
  if (lines.length <= 2) return [];

  return lines.slice(2).map(line => {
    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter((cell, index, arr) => index > 0 && index < arr.length - 1);
    return cells.length ? cells : null;
  }).filter(Boolean);
}

function extractDriveGearSetInfo(section) {
  if (!section) return null;
  
  const titleLine = section.split('\n')[0];
  const codeMatch = titleLine.match(/Code (\d+)\s*\(([^)]+)\)/i) ||
                   titleLine.match(/Series Code (\d+)\s*\(([^)]+)\)/i);
  
  if (!codeMatch) {
    // Try alternative format for nested sections
    const subHeaderMatch = section.match(/#{1,3}\s*Code\s+(\d+)\s*\(([^)]+)\)/i);
    if (subHeaderMatch) {
      return {
        code: subHeaderMatch[1],
        description: subHeaderMatch[2].trim()
      };
    }
    return null;
  }

  return {
    code: codeMatch[1],
    description: codeMatch[2].trim()
  };
}

function findAllDriveGearSets(markdown) {
  const driveGearSets = [];
  const sectionMatches = markdown.match(/#{1,3}\s*(Drive Gear Sets[^#]*(?:(?!#{1,3}\s*(?!Code))[\s\S])*)/g) || [];
  
  sectionMatches.forEach(section => {
    // Split into subsections if they exist
    const subSections = section.split(/(?=#{3}\s*Code)/);
    
    subSections.forEach(subSection => {
      const info = extractDriveGearSetInfo(subSection);
      if (info) {
        driveGearSets.push({
          code: info.code,
          description: info.description,
          content: subSection.trim()
        });
      }
    });
  });

  return driveGearSets;
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
    motorFastenersSingle: [],
    rotationOptions: [...DEFAULT_ROTATION_OPTIONS]
  };

  // Specifically handle the two major sections for 200 series
  const pumpSection = findSectionContent(cleanedMarkdown, 'Pump Components', true) || cleanedMarkdown;
  const motorSection = findSectionContent(cleanedMarkdown, 'Motor Components', true);

  // Parse SEC sections specifically for both pump and motor
  const secPumpContent = findSectionContent(pumpSection, 'Shaft End Cover (SEC)') || 
                        findSectionContent(cleanedMarkdown, 'Shaft End Cover (SEC)');
                        
  if (secPumpContent) {
    data.shaftEndCovers = parseTableData(secPumpContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);

    console.log('Parsed pump SEC:', data.shaftEndCovers);
  }

  const secMotorContent = findSectionContent(motorSection, 'Shaft End Cover (SEC)');
  if (secMotorContent) {
    data.motorShaftEndCovers = parseTableData(secMotorContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);

    console.log('Parsed motor SEC:', data.motorShaftEndCovers);
  }

  // Parse gear housings for both pump and motor
  const gearPumpContent = findSectionContent(pumpSection, 'Gear Housing') || 
                         findSectionContent(cleanedMarkdown, 'Gear Housing');
  if (gearPumpContent) {
    data.gearHousings = parseTableData(gearPumpContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);

    console.log('Parsed pump gear housings:', data.gearHousings);
  }

  const gearMotorContent = findSectionContent(motorSection, 'Gear Housing');
  if (gearMotorContent) {
    data.motorGearHousings = parseTableData(gearMotorContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || 'Same as pump'
      }))
      .filter(item => item.code && item.partNumber);

    console.log('Parsed motor gear housings:', data.motorGearHousings);
  }

  // Critical fix for drive gear sets parsing
  const driveGearSets = findAllDriveGearSets(cleanedMarkdown);
  driveGearSets.forEach(section => {
    const tableData = parseTableData(section.content);
    if (!data.driveGearSets[section.code]) {
      data.driveGearSets[section.code] = {};
    }

    // Add shaft key if present
    const shaftKeyMatch = section.content.match(/Shaft Key:\s*([A-Za-z0-9-]+)/);
    if (shaftKeyMatch) {
      data.driveGearSets[section.code].shaftKey = shaftKeyMatch[1];
    }

    // Add to shaft styles if not already present
    if (!data.shaftStyles.find(s => s.code === section.code)) {
      data.shaftStyles.push({
        code: section.code,
        description: section.description
      });
    }

    // Parse gear sets
    tableData.forEach(([code, partNumber]) => {
      if (code && partNumber && partNumber.toLowerCase() !== 'n/a') {
        data.driveGearSets[section.code][code] = partNumber;
      }
    });
  });

  console.log('Parsed shaft styles:', data.shaftStyles);

  // Parse PEC sections
  const pecPumpContent = findSectionContent(pumpSection, 'P.E.C Cover');
  if (pecPumpContent) {
    data.pecCovers = parseTableData(pecPumpContent)
      .map(([description, partNumber]) => ({
        description,
        partNumber
      }))
      .filter(item => item.partNumber);
  }

  const pecMotorContent = findSectionContent(motorSection, 'P.E.C Cover');
  if (pecMotorContent) {
    data.motorPecCovers = parseTableData(pecMotorContent)
      .map(([description, partNumber]) => ({
        description,
        partNumber
      }))
      .filter(item => item.partNumber);
  }

  // Parse remaining components (idler gears, bearing carriers, fasteners)
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

  // Parse bearing carriers with common number handling
  const bearingSection = findSectionContent(cleanedMarkdown, 'Bearing Carriers');
  if (bearingSection) {
    data.bearingCarriers = parseTableData(bearingSection)
      .map(([description, partNumber, commonNumber]) => ({
        description,
        partNumber,
        commonNumber: commonNumber ? commonNumber.replace(/[()]/g, '').trim() : ''
      }))
      .filter(item => item.partNumber);
  }

  // Parse fasteners with separate pump/motor handling
  const pumpFastenerSection = findSectionContent(cleanedMarkdown, 'Pump Fasteners - Single Units') ||
                             findSectionContent(cleanedMarkdown, 'Fasteners - Single Units');
  const motorFastenerSection = findSectionContent(cleanedMarkdown, 'Motor Fasteners - Single Units');

  if (pumpFastenerSection) {
    data.fastenersSingle = parseTableData(pumpFastenerSection)
      .map(([code, partNumber]) => ({
        code,
        partNumber
      }))
      .filter(item => item.partNumber);
  }

  if (motorFastenerSection) {
    data.motorFastenersSingle = parseTableData(motorFastenerSection)
      .map(([code, partNumber]) => ({
        code,
        partNumber
      }))
      .filter(item => item.partNumber);
  }

  // Parse multi-unit fasteners
  const doublesSection = findSectionContent(cleanedMarkdown, 'Doubles');
  if (doublesSection) {
    data.fastenersDoubles = parseTableData(doublesSection)
      .map(([condition, partNumber]) => ({
        condition: condition.trim(),
        partNumber: partNumber.trim()
      }))
      .filter(item => item.partNumber);
  }

  const triplesSection = findSectionContent(cleanedMarkdown, 'Triples/Quads');
  if (triplesSection) {
    data.fastenersTripleQuad = parseTableData(triplesSection)
      .map(([condition, partNumber]) => ({
        condition: condition.trim(),
        partNumber: partNumber.trim()
      }))
      .filter(item => item.partNumber);
  }

  return data;
}
async function loadSeriesData() {
  try {
    console.log('Starting to load series data...');
    const loadedData = {};
    
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
        
        // Validate parsed data for 200 series
        if (['230', '250', '265'].includes(series)) {
          console.log(`Validating 200 series data for ${series}:`, {
            shaftEndCovers: parsedData.shaftEndCovers?.length || 0,
            motorShaftEndCovers: parsedData.motorShaftEndCovers?.length || 0,
            gearHousings: parsedData.gearHousings?.length || 0,
            motorGearHousings: parsedData.motorGearHousings?.length || 0,
            shaftStyles: parsedData.shaftStyles?.length || 0,
            driveGearSets: Object.keys(parsedData.driveGearSets || {}).length
          });
        }

        loadedData[series] = parsedData;
      } catch (error) {
        console.error(`Error loading series ${series}:`, error);
      }
    }

    if (Object.keys(loadedData).length === 0) {
      throw new Error('No series data could be loaded');
    }

    seriesData = loadedData;
    console.log('Series data loaded successfully');
    
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

function calculateTotalGearWidth(config, currentSeriesData) {
  if (!currentSeriesData?.gearHousings || !config.gearSize) return 0;

  let totalWidth = 0;
  
  const extractWidth = (description) => {
    if (!description) return null;

    const patterns = [
      /(\d+(?:\.\d+)?)"?-\s*[\d.]+\s*C\.I\.D\./i,
      /(\d+(?:\.\d+)?)"(?=[\s-]|$)/,
      /^(\d+(?:\.\d+)?)/,
      /(\d+(?:\.\d+)?)/
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        const width = parseFloat(match[1]);
        if (!isNaN(width) && width > 0) return width;
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

function determineFastenerPartNumber(config, currentSeriesData, totalGearWidth) {
  if (!currentSeriesData || !config.gearSize) return null;

  try {
    // Handle motor vs pump fasteners for 200 series
    const fastenerSingleArray = config.type === 'M' && currentSeriesData.motorFastenersSingle?.length > 0
      ? currentSeriesData.motorFastenersSingle
      : currentSeriesData.fastenersSingle;

    if (config.pumpType === 'single') {
      const fastener = fastenerSingleArray?.find(f => f.code === config.gearSize);
      return fastener?.partNumber;
    }

    if (!config.pumpType || config.pumpType === 'single') return null;

    const fastenersMulti = config.pumpType === 'tandem' ? 
      currentSeriesData.fastenersDoubles : 
      currentSeriesData.fastenersTripleQuad;

    if (!fastenersMulti?.length) return null;

    return fastenersMulti.find(f => {
      const condition = f.condition.toLowerCase();
      const widthMatch = condition.match(/(\d+(\.\d+)?)/);
      if (!widthMatch) return false;
      
      const widthLimit = parseFloat(widthMatch[1]);
      return condition.includes('less than') ? 
        totalGearWidth < widthLimit : 
        totalGearWidth >= widthLimit;
    })?.partNumber;
  } catch (error) {
    console.error('Error determining fastener part number:', error);
    return null;
  }
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

    // Get the correct components based on type and series
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
          addToBOM(
            housing.partNumber,
            1,
            `Gear Housing ${index === 0 ? '(Primary)' : `(Section ${index + 2})`} - ${housing.description}`
          );
        }
      });
    }

    // Add drive gear set and shaft key
    if (config.shaftStyle && config.gearSize) {
      const driveGearKey = `${config.gearSize}-${config.shaftStyle}`;
      const driveGearSet = currentSeriesData.driveGearSets[config.shaftStyle];
      const driveGearPartNumber = driveGearSet?.[driveGearKey];

      if (driveGearPartNumber && driveGearPartNumber !== 'N/A') {
        const shaftStyle = currentSeriesData.shaftStyles?.find(s => s.code === config.shaftStyle);
        
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
      const pecCover = components.pecCovers?.find(pec => pec.partNumber === config.pecSelection);
      if (pecCover) {
        addToBOM(
          pecCover.partNumber,
          1,
          `PEC Cover - ${pecCover.description}`
        );
      }
    }

    // Add bearing carrier for multi-section pumps
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
    if (config.gearSize) {
      const totalGearWidth = calculateTotalGearWidth(config, currentSeriesData);
      const fastenerPartNumber = determineFastenerPartNumber(config, currentSeriesData, totalGearWidth);
      
      if (fastenerPartNumber) {
        const fastenerQty = config.series === '76' ? 8 : 4;
        addToBOM(
          fastenerPartNumber,
          fastenerQty,
          `Fastener${fastenerQty > 4 ? 's' : ''} for ${config.pumpType || 'single'} unit`
        );
      }
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

  } catch (error) {
    console.error('Error generating BOM:', error);
  }

  return bom;
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

  const [config, setConfig] = React.useState(initialState);
  const [bom, setBom] = React.useState([]);
  const [error, setError] = React.useState(null);

  const is200Series = React.useMemo(() => 
    ['230', '250', '265'].includes(config.series), [config.series]);
  const is300Series = React.useMemo(() => 
    ['315', '330', '350', '365'].includes(config.series), [config.series]);

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
  // Continue PumpConfigurator component...

  // Continue PumpConfigurator component...

  const createEmptyOption = () => React.createElement(
    'option',
    { value: '', key: 'empty' },
    '-- Select --'
  );

  const getAvailableComponents = (seriesData, type) => {
    if (!seriesData) return {};

    const isMotor = type === 'M';
    console.log(`Getting ${isMotor ? 'motor' : 'pump'} components for series ${config.series}`);

    return (is200Series || is300Series) && isMotor
      ? {
          shaftEndCovers: seriesData.motorShaftEndCovers || [],
          gearHousings: seriesData.motorGearHousings || [],
          pecCovers: seriesData.motorPecCovers || [],
          bearingCarriers: seriesData.bearingCarriers || [],
          shaftStyles: seriesData.shaftStyles || []
        }
      : {
          shaftEndCovers: seriesData.shaftEndCovers || [],
          gearHousings: seriesData.gearHousings || [],
          pecCovers: seriesData.pecCovers || [],
          bearingCarriers: seriesData.bearingCarriers || [],
          shaftStyles: seriesData.shaftStyles || []
        };
  };

  const handleSeriesChange = (value) => {
    console.log('Series changed to:', value);
    const newSeriesData = seriesData[value];
    
    if (!newSeriesData) {
      console.error(`No data available for series ${value}`);
      setError(`No data available for series ${value}`);
      return;
    }

    setConfig({
      ...initialState,
      series: value
    });
    setError(null);
  };

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

  const currentSeriesData = seriesData[config.series];
  const components = currentSeriesData ? getAvailableComponents(currentSeriesData, config.type) : {};

  // Main render
  return React.createElement('div', { className: 'bg-white shadow rounded-lg max-w-4xl mx-auto' },
    error && React.createElement('div', {
      className: 'p-4 bg-red-50 border-l-4 border-red-400 text-red-700'
    }, error),

    React.createElement('div', { className: 'px-4 py-5 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-2xl font-bold text-gray-900' },
        'Hydraulic Pump Configurator'
      )
    ),

    React.createElement('div', { className: 'p-4 space-y-6' },
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

      config.series && currentSeriesData && React.createElement('div', { className: 'space-y-4' },
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

          createSelectField(
            'Rotation',
            config.rotation,
            currentSeriesData.rotationOptions || [],
            (value) => setConfig({ ...config, rotation: value })
          ),

          components.shaftEndCovers?.length > 0 && createSelectField(
            'Shaft End Cover',
            config.secCode,
            components.shaftEndCovers,
            (value) => setConfig({ ...config, secCode: value })
          ),

          components.shaftStyles?.length > 0 && createSelectField(
            'Shaft Style',
            config.shaftStyle,
            components.shaftStyles,
            (value) => setConfig({ ...config, shaftStyle: value })
          ),

          components.gearHousings?.length > 0 && createSelectField(
            'Gear Size',
            config.gearSize,
            components.gearHousings,
            (value) => setConfig({ ...config, gearSize: value })
          ),

          components.pecCovers?.length > 0 && createSelectField(
            'Port End Cover',
            config.pecSelection,
            components.pecCovers,
            (value) => setConfig({ ...config, pecSelection: value }),
            true
          ),

          config.pumpType !== 'single' && components.bearingCarriers?.length > 0 && createSelectField(
            'Bearing Carrier',
            config.bearingCarrierSelection,
            components.bearingCarriers,
            (value) => setConfig({ ...config, bearingCarrierSelection: value }),
            true
          ),

          // Model Code
          React.createElement('div', { className: 'mt-8 p-4 bg-gray-100 rounded' },
            React.createElement('h4', { 
              className: 'text-sm font-medium mb-2'
            }, 'Model Code:'),
            React.createElement('div', { 
              className: 'font-mono text-lg'
            }, generateModelCode(config))
          ),

          // BOM Table with Copy Button
          bom.length > 0 && React.createElement('div', { className: 'mt-8' },
            React.createElement('h4', { 
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