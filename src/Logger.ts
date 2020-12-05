export class getLogger {
  name: string;
  constructor(name: string) {
    this.name = name;
  }

  info = (message: string) => {
    console.log(`[INFO - ${this.name}] ${message}`);
  };

  error = (message: string) => {
    console.log(`[ERROR - ${this.name}] ${message}`);
  };
}
