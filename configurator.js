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

// NEW: Add porting code constants
const PORTING_TYPES = {
  NPT: 'NPT',
  SPLIT_FLANGE: 'Split Flange',
  ODT: 'O.D.T.'
};

const PORTING_CODE_TYPES = {
  PORT_END_COVER: 'PEC',
  GEAR_HOUSING: 'GH',
  BEARING_CARRIER: 'BC'
};

// Original code continues
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

// NEW: Add function to parse porting sections
function parsePortingCodes(markdown) {
  const portingData = {
    portEndCover: [],
    gearHousing: [],
    bearingCarrier: []
  };

  try {
    // Find porting codes section
    const portingSection = markdown.match(/# .* Series Porting Codes[\s\S]*?(?=# |$)/);
    if (!portingSection) return portingData;

    // Parse Port End Cover codes - specifically handle the 176 format
    const pecSection = findSectionContent(portingSection[0], 'Port End Cover Codes');
    if (pecSection) {
      const lines = pecSection.split('\n');
      let currentType = 'NPT';  // Default to NPT
      
      lines.forEach(line => {
        if (line.includes('|') && !line.includes('---') && !line.includes('Code W/O ST')) {
          const cells = line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell);
          
          if (cells.length >= 2) {
            const code = cells[0];
            if (code && code !== 'Code') {
              portingData.portEndCover.push({
                type: currentType,
                code: code,
                leftPort: cells[1] || '',
                rightPort: cells[2] || ''
              });
            }
          }
        }
      });
    }

    // Parse Gear Housing codes
    const ghSection = findSectionContent(portingSection[0], 'Gear Housing Codes');
    if (ghSection) {
      const lines = ghSection.split('\n');
      let currentType = 'NPT';

      lines.forEach(line => {
        if (line.includes('|') && !line.includes('---') && !line.includes('Code')) {
          const cells = line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell);
          
          if (cells.length >= 3) {
            const code = cells[0];
            if (code) {
              portingData.gearHousing.push({
                type: currentType,
                code: code,
                leftPort: cells[1] || '',
                rightPort: cells[2] || ''
              });
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('Error parsing porting codes:', error);
  }

  return portingData;
}

// NEW: Add function to parse porting tables
function parsePortingTable(section) {
  const portingEntries = [];
  let currentType = '';
  const lines = section.split('\n');

  lines.forEach(line => {
    if (line.includes('### NPT')) {
      currentType = 'NPT';
    } else if (line.includes('### Split Flange')) {
      currentType = 'Split Flange';
    } else if (line.includes('### O.D.T.')) {
      currentType = 'O.D.T.';
    } else if (line.includes('|') && !line.includes('---') && !line.includes('Code W/O ST')) {
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell);
      
      if (cells.length >= 2) {
        // Handle both single unit and multi-unit formats
        if (cells[0] && cells[0] !== 'Code') {
          portingEntries.push({
            type: currentType,
            code: cells[0],
            leftPort: cells[1] || '',
            rightPort: cells[2] || '',
            info: cells.slice(3).join(' ')
          });
        }
      }
    }
  });

  return portingEntries;
}


// Original code continues
function cleanMarkdownContent(content) {
  if (!content) return '';
  return content.toString()
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function findSectionContent(text, sectionName) {
  if (!text || !sectionName) return '';
  const pattern = new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
  const match = text.match(pattern);
  return match ? match[0].trim() : '';
}

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

function findDriveGearSections(content) {
  if (!content) return [];
  const mainPattern = /### Code \d+[^#]*?(?=###|$)/gs;
  return (content.match(mainPattern) || []).map(section => section.trim());
}

// [Continues in Part 2...]
// [Continued from Part 1...]

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

function parseBearingCarriers(section) {
  if (!section) return [];
  const tableData = parseTableData(section);
  return tableData.map(([description, partNumber, commonNumber]) => ({
    description: description.trim(),
    partNumber: partNumber.trim(),
    commonNumber: commonNumber ? commonNumber.replace(/[()]/g, '').trim() : ''
  })).filter(item => item.partNumber);
}

function validatePortingCode(code, series, config) {
  if (!code || !series) return { isValid: false, error: 'Missing code or series' };
  
  const currentSeriesData = seriesData[series];
  if (!currentSeriesData?.portingData) return { isValid: false, error: 'Series porting data not found' };
  
  code = code.toUpperCase();
  const firstCode = code.substring(0, 2);
  const secondCode = code.substring(2, 4);

  // For single units
  if (config.pumpType === 'single') {
    // Check Port End Cover code (first two letters)
    const validPortEndCover = currentSeriesData.portingData.portEndCover.some(entry => 
      entry.code.toUpperCase() === firstCode ||
      entry.code.toUpperCase().replace('Z', 'F') === firstCode ||  // Handle F/Z equivalence
      entry.code.toUpperCase().replace('F', 'Z') === firstCode
    );
    if (!validPortEndCover) {
      return { isValid: false, error: 'Invalid Port End Cover code' };
    }

    // Check Gear Housing code (last two letters)
    const validGearHousing = currentSeriesData.portingData.gearHousing.some(entry => 
      entry.code.toUpperCase() === secondCode
    );
    if (!validGearHousing) {
      return { isValid: false, error: 'Invalid Gear Housing code' };
    }

    return {
      isValid: true,
      data: {
        type: 'NPT',
        portEndCover: {
          code: firstCode,
          type: 'Port End Cover'
        },
        gearHousing: {
          code: secondCode,
          type: 'Gear Housing'
        }
      }
    };
  }
    else {
    // For multi-section units
    const validBearingCarrier = seriesPortingData.bearingCarrier.some(entry => 
      entry.code.toUpperCase() === firstCode
    );
    if (!validBearingCarrier) {
      return { isValid: false, error: 'Invalid Bearing Carrier code' };
    }

    const validGearHousing = seriesPortingData.gearHousing.some(entry => 
      entry.code.toUpperCase() === secondCode
    );
    if (!validGearHousing) {
      return { isValid: false, error: 'Invalid Gear Housing code' };
    }

    return {
      isValid: true,
      data: {
        type: 'NPT',
        bearingCarrier: {
          code: firstCode,
          type: 'Bearing Carrier'
        },
        gearHousing: {
          code: secondCode,
          type: 'Gear Housing'
        }
      }
    };
  }
}
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
    rotationOptions: [...DEFAULT_ROTATION_OPTIONS],
    // NEW: Add porting data structure
    portingData: {}
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

  // [Continues in Part 3...]
  // [Continued from Part 2...]

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

// [Continues in Part 4...]
// [Continued from Part 3...]

// Modified to include porting codes in model code generation
function generateModelCode(config) {
  if (!config.type || !config.series || !config.rotation || 
      !config.secCode || !config.gearSize || !config.shaftStyle) {
    return '';
  }

  try {
    let code = `${config.type}${config.series}A${config.rotation}${config.secCode}`;
    
    // Add primary porting code or placeholder
    code += config.portingCodes[0]?.toUpperCase() || 'XXXX';
    code += `${config.gearSize}-${config.shaftStyle}`;
    
    // Add additional sections with their porting codes
    if (config.pumpType !== 'single' && config.additionalGearSizes?.length > 0) {
      config.additionalGearSizes.forEach((size, index) => {
        if (size) {
          // Add section's porting code or placeholder
          code += config.additionalPortingCodes[index]?.toUpperCase() || 'XXXX';
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

// Modified to include porting information in BOM
function generateBOM(config) {
  if (!config || !config.series || !config.type) return [];
  
  const currentSeriesData = seriesData[config.series];
  if (!currentSeriesData) return [];

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

    // [Continues in Part 5...]
   // [Continued from Part 4...]

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
            
            // Add bearing carrier porting information if available
            if (config.additionalPortingCodes[index]) {
              const portingValidation = validatePortingCode(
                config.additionalPortingCodes[index],
                config.series,
                PORTING_CODE_TYPES.BEARING_CARRIER
              );
              if (portingValidation.isValid) {
                addToBOM('PORTING-INFO', 1,
                  `Bearing Carrier Section ${index + 2} Ports - ${formatPortingInfo(portingValidation.data)}`);
              }
            }
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
  // Modified initial state to include porting codes
  const initialState = {
    series: '',
    type: '',
    pumpType: 'single',
    rotation: '',
    secCode: '',
    gearSize: '',
    shaftStyle: '',
    pecSelection: '',
    bearingCarrierSelections: [],
    portingCodes: [''],  // Primary section porting code
    additionalGearSizes: [],
    additionalPortingCodes: [], // Additional section porting codes
  };

  const [config, setConfig] = React.useState(initialState);
  const [bom, setBom] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [portingErrors, setPortingErrors] = React.useState({});
  const [portingInfo, setPortingInfo] = React.useState({});

  // [Continues in Part 6...]
   // [Continued from Part 5...]

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

  // Add porting code field creator
  const createPortingCodeField = (index = 0, isAdditionalSection = false) => {
    const fieldId = `porting-code-${isAdditionalSection ? `section-${index + 2}` : 'primary'}`;
    const currentCode = isAdditionalSection ? 
      config.additionalPortingCodes[index] : 
      config.portingCodes[0];
    const currentError = portingErrors[fieldId];
    const currentInfo = portingInfo[fieldId];
  
    return React.createElement('div', { className: 'mb-4' },
      React.createElement('label', {
        htmlFor: fieldId,
        className: 'block text-sm font-medium mb-2 text-gray-700'
      }, `Porting Code${isAdditionalSection ? ` - Section ${index + 2}` : ''}`),
      React.createElement('input', {
        id: fieldId,
        type: 'text',
        maxLength: 4,
        className: `w-full p-2 border rounded ${currentError ? 'border-red-500' : 'border-gray-300'} focus:ring-blue-500 focus:border-blue-500 uppercase`,
        value: currentCode || '',
        onChange: (e) => handlePortingCodeChange(e.target.value, index, isAdditionalSection),
        placeholder: 'Enter porting code'
      }),
      currentError && React.createElement('p', {
        className: 'mt-1 text-sm text-red-500'
      }, currentError),
      currentInfo && React.createElement('div', {
        className: 'mt-2 p-2 bg-gray-50 rounded text-sm'
      }, [
        React.createElement('p', { key: 'type' }, `Type: ${currentInfo.type}`),
        React.createElement('p', { key: 'leftPort' }, `Left Port: ${currentInfo.leftPort}`),
        React.createElement('p', { key: 'rightPort' }, `Right Port: ${currentInfo.rightPort}`),
        currentInfo.info && React.createElement('p', { key: 'info' }, `Additional Info: ${currentInfo.info}`)
      ])
    );
  };

  // Add porting code change handler
  const handlePortingCodeChange = (value, index = 0, isAdditionalSection = false) => {
    const code = value.toUpperCase();
    const fieldId = `porting-code-${isAdditionalSection ? `section-${index + 2}` : 'primary'}`;
    
    const newConfig = { ...config };
    const newErrors = { ...portingErrors };
    const newInfo = { ...portingInfo };
  
    // Update the code in config first
    if (isAdditionalSection) {
      const newCodes = [...(newConfig.additionalPortingCodes || [])];
      newCodes[index] = code;
      newConfig.additionalPortingCodes = newCodes;
    } else {
      newConfig.portingCodes = [code];
    }
  
    // Only validate if we have enough characters
    if (code && code.length === 4) {
      try {
        const validation = validatePortingCode(code, config.series, config);
        if (validation.isValid) {
          newErrors[fieldId] = null;
          newInfo[fieldId] = validation.data;
        } else {
          newErrors[fieldId] = validation.error;
          newInfo[fieldId] = null;
        }
      } catch (error) {
        console.error('Validation error:', error);
        newErrors[fieldId] = 'Error validating porting code';
        newInfo[fieldId] = null;
      }
    } else {
      // Clear errors while typing
      newErrors[fieldId] = null;
      newInfo[fieldId] = null;
    }
  
    setConfig(newConfig);
    setPortingErrors(newErrors);
    setPortingInfo(newInfo);
  };

  // Your existing handler functions remain unchanged
  const handleSeriesChange = (value) => {
    console.log('Series changed to:', value);
    setConfig({
      ...initialState,
      series: value
    });
    setError(null);
    setPortingErrors({});
    setPortingInfo({});
  };

  // [Continues in Part 7...]
  // [Continued from Part 6...]

  const handleTypeChange = (value) => {
    console.log('Type changed to:', value);
    setConfig({
      ...config,
      type: value,
      secCode: '',
      gearSize: '',
      shaftStyle: '',
      pecSelection: '',
      bearingCarrierSelections: [],
      portingCodes: [''],
      additionalPortingCodes: []
    });
    setPortingErrors({});
    setPortingInfo({});
  };

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
    setPortingErrors({});
    setPortingInfo({});
  };

  const handleBearingCarrierChange = (value, index) => {
    const newSelections = [...config.bearingCarrierSelections];
    newSelections[index] = value;
    setConfig({ ...config, bearingCarrierSelections: newSelections });
  };

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

  // Create empty option (unchanged)
  const createEmptyOption = () => React.createElement(
    'option',
    { value: '', key: 'empty' },
    '-- Select --'
  );

  // Create select field (unchanged)
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

  // [Continues in Part 8 with the main render implementation...]
  // [Continued from Part 7...]

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
// Shaft End Cover
components.shaftEndCovers?.length > 0 && createSelectField(
  'Shaft End Cover',
  config.secCode,
  components.shaftEndCovers,
  (value) => setConfig({ ...config, secCode: value })
),

// Porting Code - Always show
createPortingCodeField(),

// Gear Size 
components.gearHousings?.length > 0 && createSelectField(
  'Gear Size',
  config.gearSize,
  components.gearHousings,
  (value) => setConfig({ ...config, gearSize: value })
),

          // Add primary porting code field after gear size
         

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
              // Add porting code field for this section
              size && createPortingCodeField(index, true),
              // Add bearing carrier selection
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

          // [Continues in Part 9 with BOM table and initialization code...]
          // [Continued from Part 8...]

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

// Modified loadSeriesData to include porting data processing
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
        // Add porting data to the parsed data
        parsedData.portingData = parsePortingCodes(content);
        
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