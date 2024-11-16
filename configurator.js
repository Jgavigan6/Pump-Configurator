async function loadSeriesData() {
  try {
    // Use window.fs.readFile instead of fetch
    const fileContent = await window.fs.readFile('120-series.md', { encoding: 'utf8' });
    seriesData = await parseMarkdownData(fileContent);
    initializeConfigurator();
  } catch (error) {
    console.error('Error loading series data:', error);
    document.getElementById('root').innerHTML = `Error loading configurator data: ${error.message}`;
  }
}