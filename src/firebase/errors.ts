export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
    constructor(public context: SecurityRuleContext) {
        const { path, operation } = context;
        const message = `Firestore Permission Denied: Operation '${operation}' on path '${path}' was denied by security rules.`;
        super(message);
        this.name = 'FirestorePermissionError';

        // This is to make the error object serializable for the Next.js dev overlay
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
