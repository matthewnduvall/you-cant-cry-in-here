module.exports = function csvRawLoader(source) {
  return `export default ${JSON.stringify(String(source || ''))};`;
};

