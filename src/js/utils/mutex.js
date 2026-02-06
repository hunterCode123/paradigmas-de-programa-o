// Implementação de Mutex usando Atomics e SharedArrayBuffer
export class Mutex {
    constructor(sharedBuffer, offset = 0) {
        this.buffer = new Int32Array(sharedBuffer, offset, 1);
        this.UNLOCKED = 0;
        this.LOCKED = 1;
    }

    lock() {
        while (true) {
            const oldValue = Atomics.compareExchange(
                this.buffer,
                0,
                this.UNLOCKED,
                this.LOCKED
            );
            
            if (oldValue === this.UNLOCKED) {
                return; // Lock adquirido
            }
            
            // Aguarda notificação
            Atomics.wait(this.buffer, 0, this.LOCKED, 100);
        }
    }

    unlock() {
        Atomics.store(this.buffer, 0, this.UNLOCKED);
        Atomics.notify(this.buffer, 0, 1);
    }

    tryLock() {
        const oldValue = Atomics.compareExchange(
            this.buffer,
            0,
            this.UNLOCKED,
            this.LOCKED
        );
        return oldValue === this.UNLOCKED;
    }
}

// Mutex Manager para coordenar múltiplos mutexes
export class MutexManager {
    constructor(numMutexes = 1) {
        // Cada mutex precisa de 4 bytes (Int32)
        const bufferSize = numMutexes * 4;
        this.sharedBuffer = new SharedArrayBuffer(bufferSize);
        this.mutexes = [];
        
        for (let i = 0; i < numMutexes; i++) {
            this.mutexes.push(new Mutex(this.sharedBuffer, i * 4));
        }
    }

    getMutex(index = 0) {
        return this.mutexes[index];
    }

    getSharedBuffer() {
        return this.sharedBuffer;
    }
}