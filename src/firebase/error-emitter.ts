// A simple event emitter for handling global errors, like Firestore permission errors.
// This allows us to decouple the error source from the error handling logic.

type Listener<T> = (data: T) => void;

class EventEmitter<T> {
    private listeners: Map<string, Listener<T>[]> = new Map();

    on(event: string, listener: Listener<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
        
        // Return an unsubscribe function
        return () => this.off(event, listener);
    }

    off(event: string, listener: Listener<T>): void {
        if (!this.listeners.has(event)) {
            return;
        }
        const eventListeners = this.listeners.get(event)!.filter(l => l !== listener);
        this.listeners.set(event, eventListeners);
    }

    emit(event: string, data: T): void {
        if (!this.listeners.has(event)) {
            return;
        }
        this.listeners.get(event)!.forEach(listener => listener(data));
    }
}

export const errorEmitter = new EventEmitter<any>();

    