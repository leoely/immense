import StorageClient from '~/class/StorageClient';

class MultiStorageClient {
  constructor() {
    this.storageClients = [];
    this.index = 0;
  }

  addStorageClient(storageClient) {
    if (!(storageClient instanceof StorageClient)) {
      throw new Error('[Error] The type of storageClient added is incorrect.');
    }
    const {
      allStorages,
    } = storageClient;
    if (allStorages === 0) {
      throw new Error('[Error] Adding storageClient with an empty all storages has not practical effect.');
    }
    this.storageClients.push(storageClient);
  }

  async getNextIndex() {
  }

  async readData(...params) {
  }

  async readBufferPiece(...params) {
  }

  async writeBufferPiece(...params) {
  }

  async writeBuffer(...params) {
  }

  async addBuffer(...params) {
  }

  async appendData(...params) {
  }

  async remove(...params) {
  }

  async truncate(...params) {
  }

  async rename(...params) {
  }

  async diskOccupy(...params) {
  }

  async cp(...params) {
  }

  async link(...params) {
  }

  async stats(...params) {
  }

  async chmod(...params) {
  }

  async chown(...params) {
  }

  async access(...params) {
  }

  async realpath(...params) {
  }

  async readdir(...params) {
  }

  async mkdir(...params) {
  }

  async rmdir(...params) {
  }

  async glob(...params) {
  }
}

export default MultiStorageClient;
