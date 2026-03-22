import { WindowEntity } from '../entities/window.entity';

export abstract class WindowRepository {
  abstract getAll(): WindowEntity[];
  abstract getById(id: string): WindowEntity | undefined;
  abstract save(window: WindowEntity): void;
  abstract remove(id: string): void;
}
