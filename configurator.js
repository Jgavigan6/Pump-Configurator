[Previous code remains the same until PumpConfigurator component...]

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

  // Add useEffect to update BOM whenever config changes
  React.useEffect(() => {
    setBom(generateBOM(config));
  }, [config]);

  // BOM Generation Function
  const generateBOM = (config) => {
    if (!config.type || !config.secCode || !config.gearSize || !config.shaftStyle) {
      return [];
    }

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

    // Add idler gear sets for tandem/triple/quad
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
  };

  // [Previous component code remains the same until the return statement]

  return React.createElement('div', { className: 'bg-white shadow rounded-lg max-w-4xl mx-auto' },
    // Header and other content remains the same...

    // Add BOM Display
    bom.length > 0 && React.createElement('div', { className: 'mt-8 p-4' },
      React.createElement('h3', { className: 'text-lg font-medium mb-4' }, 'Bill of Materials'),
      React.createElement('div', { className: 'flex' },
        // Part Numbers and Quantities
        React.createElement('div', { className: 'flex-1 border-r pr-4' },
          React.createElement('table', { className: 'w-full text-sm' },
            React.createElement('thead', null,
              React.createElement('tr', { className: 'bg-gray-50' },
                React.createElement('th', { className: 'px-4 py-2 text-left' }, 'Part Number'),
                React.createElement('th', { className: 'px-4 py-2 text-left' }, 'Qty')
              )
            ),
            React.createElement('tbody', null,
              bom.map((item, index) =>
                React.createElement('tr', { key: index, className: 'border-t' },
                  React.createElement('td', { className: 'px-4 py-2 font-mono' }, item.partNumber),
                  React.createElement('td', { className: 'px-4 py-2' }, item.quantity)
                )
              )
            )
          )
        ),
        // Descriptions
        React.createElement('div', { className: 'flex-1 pl-4' },
          React.createElement('table', { className: 'w-full text-sm' },
            React.createElement('thead', null,
              React.createElement('tr', { className: 'bg-gray-50' },
                React.createElement('th', { className: 'px-4 py-2 text-left' }, 'Description')
              )
            ),
            React.createElement('tbody', null,
              bom.map((item, index) =>
                React.createElement('tr', { key: index, className: 'border-t' },
                  React.createElement('td', { className: 'px-4 py-2' }, item.description)
                )
              )
            )
          )
        )
      )
    )
  );
};

[Rest of the code remains the same...]