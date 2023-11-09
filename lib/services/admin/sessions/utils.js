import jwt           from 'jsonwebtoken';
import { tokens }    from '../../../config';
import AdminUser     from '../../../models/AdminUser';

const TokenExpiredError = jwt.TokenExpiredError;
const JsonWebTokenError = jwt.JsonWebTokenError;

export async function validateToken(token) {
    try {
        const data = jwt.decode(token);

        if (!data || !data.userId) throw new JsonWebTokenError('invalid token');

        const adminUser = await AdminUser.findByPk(data.userId);

        if (!adminUser) throw new JsonWebTokenError('invalid token');

        const secret = tokens.accessToken.secret + adminUser.login + adminUser.passwordHash;

        const tokenMaxAge = tokens.accessToken.lifetime;

        if (parseInt(tokenMaxAge, 10) !== 0 && (new Date() / 1000 - data.iat > tokenMaxAge)) {
            // TOKEN EXPIRED
            throw new TokenExpiredError('TOKEN EXPIRED', new Date((data.iat + tokenMaxAge) * 1000));
        }

        return [ jwt.verify(token, secret), adminUser ];
    } catch (e) {
        if (e instanceof TokenExpiredError) throw new Error('Token expired');
        else if (e instanceof JsonWebTokenError) throw new Error('Wrong token');
        // eslint-disable-next-line more/no-duplicated-chains
        else throw new Error('Wrong token');
    }
}

export default {
    validateToken
};
