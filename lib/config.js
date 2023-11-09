import path from 'path';
import confme from 'confme';

const config = confme(path.join(__dirname, '../etc/config.json'));

export default config;
