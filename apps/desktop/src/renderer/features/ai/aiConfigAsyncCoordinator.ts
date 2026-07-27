/**
 * 模块用途：串行配置草稿写入，并让界面识别已经过期的连接测试结果。
 * 模块边界：不持有配置内容，不访问 React、IPC、磁盘或模型服务。
 */
export class AiConfigAsyncCoordinator {
  private connectionEpoch = 0;
  private draftQueue: Promise<void> = Promise.resolve();
  private formRevision = 0;

  beginConnection(): number {
    this.connectionEpoch += 1;
    return this.connectionEpoch;
  }

  invalidateConnection(): void {
    this.connectionEpoch += 1;
  }

  markFieldChanged(): void {
    this.formRevision += 1;
    this.invalidateConnection();
  }

  getFormRevision(): number {
    return this.formRevision;
  }

  isCurrentForm(revision: number): boolean {
    return revision === this.formRevision;
  }

  isCurrentConnection(epoch: number): boolean {
    return epoch === this.connectionEpoch;
  }

  enqueueDraft(save: () => Promise<void>): Promise<void> {
    const result = this.draftQueue.then(save);
    this.draftQueue = result.catch(() => undefined);
    return result;
  }

  waitForDrafts(): Promise<void> {
    return this.draftQueue;
  }
}
