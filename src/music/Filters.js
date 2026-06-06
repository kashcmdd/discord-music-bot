const FILTERS = {
  clear: '',
  bass: 'bass=g=10,dynaudnorm=f=150',
  nightcore: 'asetrate=44100*1.25,aresample=44100',
  vaporwave: 'asetrate=44100*0.8,aresample=44100,atempo=1.0',
};

function getFilterChain(name) {
  return FILTERS[name] || FILTERS.clear;
}

function getAvailableFilters(tier = 'free') {
  if (tier === 'vip') return Object.keys(FILTERS).concat('custom');
  if (tier === 'pro') return ['clear', 'bass', 'nightcore', 'vaporwave'];
  return ['clear', 'bass'];
}

module.exports = { FILTERS, getFilterChain, getAvailableFilters };
