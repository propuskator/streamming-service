import { createHash } from 'crypto';

function getRandomInt(min, max) {
    const minBorder = Math.ceil(min);
    const maxBorder = Math.floor(max);

    return Math.floor(Math.random() * (maxBorder - minBorder)) + minBorder;
}

function getId() {
    const timestamp = `${Date.now()}`.slice(0, -3);

    return +`${timestamp}${getRandomInt(100000, 999999)}`;
}

function getIds(n) {
    const ids = [];

    for (let i = 0; i < n; ++i) { // eslint-disable-line
        let id = getId();

        // TODO: Need avoid infinity loop
        while (ids.includes(id)) id = getId();
        ids.push(id);
    }

    return ids;
}

export default {
    createHash(str) {
        return createHash('sha256').update(str).digest('hex');
    },
    getId,
    getIds

};
