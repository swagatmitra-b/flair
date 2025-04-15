// this will verify the message that was created in the frontend
// Debashish Buragohain
// defining the Verification error types
var VerificationErrorType;
(function (VerificationErrorType) {
    VerificationErrorType["ADDRESS_MISMATCH"] = "ADDRESS_MISMATCH";
    VerificationErrorType["DOMAIN_MISMATCH"] = "DOMAIN_MISMATCH";
    VerificationErrorType["URI_MISMATCH"] = "URI_MISMATCH";
    VerificationErrorType["CHAIN_ID_MISMATCH"] = "CHAIN_ID_MISMATCH";
    VerificationErrorType["ISSUED_TOO_FAR_IN_THE_PAST"] = "ISSUED_TOO_FAR_IN_THE_PAST";
    VerificationErrorType["ISSUED_TOO_FAR_IN_THE_FUTURE"] = "ISSUED_TOO_FAR_IN_THE_FUTURE";
    VerificationErrorType["EXPIRED"] = "EXPIRED";
    VerificationErrorType["EXPIRES_BEFORE_ISSUANCE"] = "EXPIRES_BEFORE_ISSUANCE";
    VerificationErrorType["VALID_AFTER_EXPIRATION"] = "VALID_AFTER_EXPIRATION";
})(VerificationErrorType || (VerificationErrorType = {}));
// basically checks all the properties and returns the error list
// need to modi 
export function verify(data, opts) {
    const { expectedAddress, expectedURL, expectedChainId, issuedAtThreshold } = opts;
    const errors = [];
    const now = Date.now();
    // verify if the parsed address is the same as the expected address
    if (data.address !== expectedAddress) {
        errors.push(VerificationErrorType.ADDRESS_MISMATCH);
    }
    // verify if the parsed domain is the same as the expected domain
    if (data.domain !== expectedURL.host) {
        errors.push(VerificationErrorType.DOMAIN_MISMATCH);
    }
    // if the parsed uri is same as the expected uri
    if (data.uri && new URL(data.uri).origin !== expectedURL.origin) {
        errors.push(VerificationErrorType.URI_MISMATCH);
    }
    // if the parsed chainId is same as the expected chainId
    if (data.chainId && data.chainId !== expectedChainId) {
        errors.push(VerificationErrorType.CHAIN_ID_MISMATCH);
    }
    // verify if the parsed issuedAt is within +- issuedAtThreshold of the current timestamp
    // NOTE: Phantom's issuedAtThreshold is 10 mins
    // note that issuedAt needs to be in an ISO string format
    if (data.issuedAt) {
        const iat = new Date(data.issuedAt).getTime();
        if (Math.abs(iat - now) > issuedAtThreshold) {
            if (iat > now) {
                // expired tokens
                errors.push(VerificationErrorType.ISSUED_TOO_FAR_IN_THE_PAST);
            }
            else {
                // yet to be valid tokens
                // didn't know something like this existed XD
                errors.push(VerificationErrorType.ISSUED_TOO_FAR_IN_THE_FUTURE);
            }
        }
    }
    // verify if the parsed expirationTime is:
    // 1. after the current timestamp
    // 2. after the parsed issuedAt
    // 3. after the parsed notBefore
    if (data.expirationTime) {
        const exp = new Date(data.expirationTime).getTime();
        if (exp <= now) {
            // token is expired
            errors.push(VerificationErrorType.EXPIRED);
        }
        if (data.issuedAt && exp < new Date(data.issuedAt).getTime()) {
            // means there is an error in the setting of the expiry time
            errors.push(VerificationErrorType.EXPIRES_BEFORE_ISSUANCE);
        }
        // not before
        if (data.notBefore) {
            const nbf = new Date(data.notBefore).getTime();
            if (nbf > exp) {
                errors.push(VerificationErrorType.VALID_AFTER_EXPIRATION);
            }
        }
    }
    return errors;
}
