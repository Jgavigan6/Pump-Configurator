aimport React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

// Series data (as before...)
const series120Data = {
  shaftEndCovers: [
    { code: '08', partNumber: '0420-040-501', description: '2-Bolt B' },
    { code: '05', partNumber: '0420-041-501', description: '2-Bolt A' },
    { code: '07', partNumber: '0420-048-501', description: '2-Bolt B Type II' },
    { code: '53', partNumber: '0420-042-501', description: '4-Bolt B' },
    { code: '38', partNumber: '0420-049-501', description: '4-Bolt "R" Flange' },
    { code: '16', partNumber: '0420-043-501', description: '6-Bolt Rnd 2.62"' },
    { code: '57', partNumber: '0420-045-501', description: '2 & 4-Bolt B' }
  ],
  // ... (rest of the series data remains the same)
  shaftStyles: [
    { code: '36', description: '7/8-13 Spl.' },
    { code: '41', description: '7/8" Keyed' },
    { code: '54', description: '1.00" Keyed' },
    { code: '76', description: 'Type II 7/8-13" Spl' }
  ]
};

const PumpConfigurator = () => {
  const [config, setConfig] = useState({
    type: 'P',
    series: '120',
    pumpType: 'single',
    rotation: '1',
    secCode: '53',
    gearSize: '20',
    shaftStyle: '36',
    additionalGearSizes: [],
    portingCodes: ['XXXX'],
    additionalPortingCodes: []
  });

  const [bom, setBom] = useState([]);

  // Generate BOM function remains the same...

  const generateModelCode = () => {
    let code = `${config.type}${config.series}A${config.rotation}${config.secCode}`;
    code += config.portingCodes[0];
    code += `${config.gearSize}-${config.shaftStyle}`;
    
    if (config.pumpType !== 'single') {
      config.additionalGearSizes.forEach((size, index) => {
        code += config.additionalPortingCodes[index] || 'XXXX';
        code += `${size}-${index + 1}`;
      });
    }
    
    return code;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Hydraulic Gear Pump Configurator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Type</label>
              <select 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={config.type}
                onChange={(e) => setConfig({ ...config, type: e.target.value })}
              >
                <option value="P">Pump (P)</option>
                <option value="M">Motor (M)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Pump Type</label>
              <select 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={config.pumpType}
                onChange={(e) => {
                  const newConfig = { ...config, pumpType: e.target.value };
                  if (e.target.value === 'single') {
                    newConfig.additionalGearSizes = [];
                    newConfig.additionalPortingCodes = [];
                  } else {
                    const count = e.target.value === 'tandem' ? 1 : e.target.value === 'triple' ? 2 : 3;
                    newConfig.additionalGearSizes = Array(count).fill(config.gearSize);
                    newConfig.additionalPortingCodes = Array(count).fill('XXXX');
                  }
                  setConfig(newConfig);
                }}
              >
                <option value="single">Single</option>
                <option value="tandem">Tandem</option>
                <option value="triple">Triple</option>
                <option value="quad">Quad</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Rotation</label>
              <select 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={config.rotation}
                onChange={(e) => setConfig({ ...config, rotation: e.target.value })}
              >
                {series120Data.rotationOptions.map(option => (
                  <option key={option.code} value={option.code}>
                    {option.code} - {option.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Shaft End Cover</label>
              <select 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={config.secCode}
                onChange={(e) => setConfig({ ...config, secCode: e.target.value })}
              >
                {series120Data.shaftEndCovers.map(sec => (
                  <option key={sec.code} value={sec.code}>
                    {sec.code} - {sec.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Primary Porting Code</label>
              <input
                type="text"
                maxLength={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={config.portingCodes[0]}
                onChange={(e) => setConfig({
                  ...config,
                  portingCodes: [e.target.value.toUpperCase()]
                })}
                placeholder="XXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Gear Size</label>
              <select 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={config.gearSize}
                onChange={(e) => setConfig({ ...config, gearSize: e.target.value })}
              >
                {series120Data.gearHousings.map(housing => (
                  <option key={housing.code} value={housing.code}>
                    {housing.code} - {housing.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Shaft Style</label>
            <select 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              value={config.shaftStyle}
              onChange={(e) => setConfig({ ...config, shaftStyle: e.target.value })}
            >
              {series120Data.shaftStyles.map(style => (
                <option key={style.code} value={style.code}>
                  {style.code} - {style.description}
                </option>
              ))}
            </select>
          </div>

          {config.pumpType !== 'single' && config.additionalGearSizes.map((size, index) => (
            <div key={index} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">
                  Additional Gear Size {index + 1}
                </label>
                <select 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={size}
                  onChange={(e) => {
                    const newSizes = [...config.additionalGearSizes];
                    newSizes[index] = e.target.value;
                    setConfig({ ...config, additionalGearSizes: newSizes });
                  }}
                >
                  {series120Data.gearHousings.map(housing => (
                    <option key={housing.code} value={housing.code}>
                      {housing.code} - {housing.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Additional Porting Code {index + 1}
                </label>
                <input
                  type="text"
                  maxLength={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={config.additionalPortingCodes[index] || 'XXXX'}
                  onChange={(e) => {
                    const newCodes = [...config.additionalPortingCodes];
                    newCodes[index] = e.target.value.toUpperCase();
                    setConfig({ ...config, additionalPortingCodes: newCodes });
                  }}
                  placeholder="XXXX"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Model Code Display */}
        <div className="mt-8 p-4 bg-gray-100 rounded">
          <label className="block text-sm font-medium mb-2">Model Code:</label>
          <div className="font-mono text-lg">{generateModelCode()}</div>
        </div>

        {/* BOM Display */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Bill of Materials</h3>
          <div className="flex">
            {/* Part Numbers and Quantities (separately selectable) */}
            <div className="flex-1 border-r pr-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Part Number</th>
                    <th className="px-4 py-2 text-left">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2 font-mono">{item.partNumber}</td>
                      <td className="px-4 py-2">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Descriptions (separate table) */}
            <div className="flex-1 pl-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PumpConfigurator;