console.log('Loading configurator...');

let seriesData = {};
const DEBUG = true;

function debugLog(context, data, type = 'info') {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${String(type).toUpperCase()}] ${context}: `;
  console[type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log'](prefix, data);
}

const SERIES_FILES = {
  '20': './20.md',
  '51': './51.md',
  '76': './76.md',
  '120': './120.md',
  '131': './131.md',
  '151': './151.md',
  '176': './176.md',
  '215': './215.md',
  '230': './230.md',
  '250': './250.md',
  '265': './265.md',
  '315': './315.md',
  '330': './330.md',
  '350': './350.md',
  '365': './365.md'
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
  return content.toString().replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
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
    if (lines.length < 2) return [];
    return lines.slice(2)
      .map(line => line.split('|')
        .map(cell => cell.trim())
        .filter((cell, index, arr) => index > 0 && index < arr.length - 1))
      .filter(cells => cells.length);
  } catch (error) {
    debugLog('Error', `Error parsing table data: ${error.message}`, 'error');
    return [];
  }
}

function findDriveGearSections(content) {
  if (!content) return [];
  const pattern = /### Code \d+[^#]*?(?=###|$)/gs;
  return (content.match(pattern) || []).map(section => section.trim());
}

async function loadSeriesData() {
  try {
    debugLog('Loading', 'Starting to load series data...');
    const loadedData = {};
    
    for (const [series, filename] of Object.entries(SERIES_FILES)) {
      try {
        debugLog('Series Loading', `Loading series ${series} from ${filename}`);
        
        let content;
        try {
          const buffer = await window.fs.readFile(filename);
          content = buffer.toString();
          debugLog('File Read', `Successfully read ${filename} as buffer`);
        } catch (bufferError) {
          debugLog('Buffer Read Failed', `Failed to read ${filename} as buffer: ${bufferError.message}`);
          content = await window.fs.readFile(filename, 'utf8');
          debugLog('File Read', `Successfully read ${filename} directly`);
        }

        if (!content) {
          throw new Error(`No content read from ${filename}`);
        }

        const cleanContent = content.toString().trim();
        if (!cleanContent) {
          throw new Error(`Empty content in ${filename}`);
        }

        const parsedData = await parseMarkdownData(cleanContent);
        debugLog('Parsing', `Successfully parsed data for series ${series}`);
        
        if (!parsedData) {
          throw new Error(`Failed to parse data from ${filename}`);
        }

        loadedData[series] = parsedData;
        debugLog('Success', `Successfully loaded series ${series}`);

      } catch (error) {
        debugLog('Error', `Failed to process ${filename}: ${error.message}`, 'error');
        console.error(`Detailed error for ${filename}:`, error);
      }
    }

    if (Object.keys(loadedData).length === 0) {
      throw new Error('Failed to load any series data. Please check the console for detailed errors.');
    }

    seriesData = loadedData;
    debugLog('Complete', `Successfully loaded ${Object.keys(loadedData).length} series`);
    initializeConfigurator();
    
  } catch (error) {
    debugLog('Fatal Error', error.message, 'error');
    document.getElementById('root').innerHTML = `
      <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <h3 class="font-bold mb-2">Error loading configurator data:</h3>
        <p>${error.message}</p>
        <p class="mt-2 text-sm">Files in directory:</p>
        <pre class="mt-1 text-xs">${Object.values(SERIES_FILES).join('\n')}</pre>
        <p class="mt-2 text-sm font-bold">Error Details:</p>
        <pre class="mt-1 text-xs">${error.stack || error.toString()}</pre>
      </div>
    `;
  }
}
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

        const shaftKeyMatch = section.match(/Shaft Key: ([\w-]+)/);
        if (shaftKeyMatch) {
          driveGearSets[code].shaftKey = shaftKeyMatch[1];
        }

        parseTableData(section).forEach(([gearCode, partNumber]) => {
          if (gearCode && partNumber && partNumber.toLowerCase() !== 'n/a') {
            const gearMatch = gearCode.match(/^(\d+)-\d+$/);
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

  // Process drive gear sections first
  const { driveGearSets, shaftStyles } = processGearSections(cleanedMarkdown);
  data.driveGearSets = driveGearSets;
  data.shaftStyles = shaftStyles;

  // Parse shaft end covers
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

  // Parse gear housings
  const pumpGearContent = findSectionContent(cleanedMarkdown, 'Gear Housing - Pump') ||
                         findSectionContent(cleanedMarkdown, 'Gear Housing');
  if (pumpGearContent) {
    data.gearHousings = parseTableData(pumpGearContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || 'Standard'
      }))
      .filter(item => item.code && item.partNumber);
  }

  const motorGearContent = findSectionContent(cleanedMarkdown, 'Gear Housing - Motor');
  if (motorGearContent) {
    data.motorGearHousings = parseTableData(motorGearContent)
      .map(([code, partNumber, description]) => ({
        code,
        partNumber,
        description: description || code
      }))
      .filter(item => item.code && item.partNumber);
  }

  // Parse PEC covers
  const pumpPecContent = findSectionContent(cleanedMarkdown, 'P\\.E\\.C Cover') || 
                        findSectionContent(cleanedMarkdown, 'Port End Covers');
  if (pumpPecContent) {
    data.pecCovers = parseTableData(pumpPecContent)
      .map(([description, partNumber]) => ({
        description,
        partNumber
      }))
      .filter(item => item.partNumber && item.description);
  }

  // Parse remaining sections
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

  // Parse fasteners
  const singleFasteners = findSectionContent(cleanedMarkdown, 'Fasteners - Single Units');
  if (singleFasteners) {
    data.fastenersSingle = parseTableData(singleFasteners)
      .map(([code, partNumber]) => ({
        code,
        partNumber
      }))
      .filter(item => item.partNumber);
  }

  const doublesSection = findSectionContent(cleanedMarkdown, 'Doubles');
  if (doublesSection) {
    data.fastenersDoubles = parseTableData(doublesSection)
      .map(([condition, partNumber]) => ({
        condition: condition.trim(),
        partNumber: partNumber.trim()
      }))
      .filter(item => item.partNumber);
  }

  const triplesSection = findSectionContent(cleanedMarkdown, 'Triples/Quads') ||
                        findSectionContent(cleanedMarkdown, 'Triples');
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

function calculateTotalGearWidth(config, currentSeriesData) {
  if (!currentSeriesData?.gearHousings || !config.gearSize) return 0;

  let totalWidth = 0;
  const extractWidth = (description) => {
    if (!description) return null;
    const match = description.match(/(\d+(?:\.\d+)?)"?[-\s]/);
    return match ? parseFloat(match[1]) : null;
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
    const widthMatch = f.condition.match(/(\d+(\.\d+)?)/);
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
    debugLog('Error', `Error generating model code: ${error.message}`, 'error');
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

    // Add idler gear sets
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

    // Add bearing carrier
    if (['tandem', 'triple', 'quad'].includes(config.pumpType) && config.bearingCarrierSelection) {
      const qty = determineBearingCarrierQty(config.pumpType);
      const bearingCarrier = currentSeriesData.bearingCarriers?.find(
        bc => bc.partNumber === config.bearingCarrierSelection
      );
      
      if (bearingCarrier && qty > 0) {
        addToBOM(bearingCarrier.partNumber, qty,
          `Bearing Carrier - ${bearingCarrier.description}${
            bearingCarrier.commonNumber ? ` (${bearingCarrier.commonNumber})` : ''}`);
      }
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
    if (config.type && config.pumpType) {
      const pumpTypeNumber = {
        'single': '1',
        'tandem': '2',
        'triple': '3',
        'quad': '4'
      }[config.pumpType];
      
      if (pumpTypeNumber) {
        addToBOM(`${config.type}${config.series}-${pumpTypeNumber}`, 1, 'Small Parts Kit');
      }
    }

  } catch (error) {
    debugLog('Error', `Error generating BOM: ${error.message}`, 'error');
  }

  return bom;
}

// Add debugging function
window.testFileRead = async (filename) => {
  try {
    console.log(`Testing file read for: ${filename}`);
    const content = await window.fs.readFile(filename);
    console.log('Success! Content preview:', content.toString().slice(0, 100));
    return true;
  } catch (error) {
    console.error(`Failed to read ${filename}:`, error);
    return false;
  }
};

// Initialize configurator
function initializeConfigurator() {
  ReactDOM.render(React.createElement(PumpConfigurator), document.getElementById('root'));
}

window.onload = loadSeriesData;
