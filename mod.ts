import * as Path from 'https://deno.land/std/path/mod.ts';

export const red = (a: string): string => `\x1b[31m${a}\x1b[0m`;
export const green = (a: string): string => `\x1b[32m${a}\x1b[0m`;
export const yellow = (a: string): string => `\x1b[33m${a}\x1b[0m`;

export const timeNow = (): number => (new Date()).getTime();
export const timeFormat = (a: number): string => `${(a / 1000).toFixed(2)} sec`;

export const numberFormat = (a: number): string => {
    const s: string = a.toString();
    let ret: string = '';
    let idx: number = 0;
    for (let i = (s.length - 1); i >= 0; i--) {
        if (idx === 3) {
            ret = (' ' + ret);
            idx = 0;
        }
        ret = (s[i] + ret);
        idx += 1;
    }
    return ret;
}

export const tempPath = (): string => {
    if (Deno.build.os == "windows") return "C:\\Temp";
    else if (Deno.build.os == "darwin") return "/tmp";
    else if (Deno.build.os == "linux") return "/tmp";
    else throw new Error(`Platform "${Deno.build.os}" is not supported`);
}

export const dirName = (): string => {
    const parts = Path.resolve(Deno.cwd()).split(Path.sep);
    return parts[parts.length - 1];
}

export interface IStat {
    path: string;
    exists: boolean;
    isFile: boolean;
    isDirectory: boolean;
    modified: number;
    size: number;
}

export const stat = (path: string): IStat => {
    try {
        const stat = Deno.statSync(path);
        return {
            path,
            exists: true,
            isFile: stat.isFile,
            isDirectory: stat.isDirectory,
            modified: stat.mtime?.getTime() ?? 0,
            size: stat.size
        }
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            return {
                path,
                exists: false,
                isFile: false,
                isDirectory: false,
                modified: 0,
                size: 0
            }
        }
        throw e;
    }
}

export enum Color {
    Yellow = 'yellow',
    Green  = 'green',
    Red    = 'red'
}

export enum Align {
    Left   = 'left',
    Center = 'center',
    Right  = 'right'
}

export class Renderer {
    private _lines: number = 0;
    private _cursor: number = 0;
    public get cursor(): number {
        return this._cursor;
    }
    public write(text: string): void {
        if (text.includes('\n'))
            throw new Error('Renderer.write(): "\\n" is not allowed here, use Renderer.break() instead');
        const rem = (Deno.consoleSize(Deno.stdout.rid).columns - this._cursor);
        const out = text.substr(0, rem);
        this._cursor += out.length;
        Deno.stdout.writeSync(new TextEncoder().encode(out));
    }
    public writeValue(value: string, width: number, align: Align | undefined, color: Color | undefined) {
        let out = value.substr(0, width);
        if ((out.length < width)
        && (align !== undefined)
        && (align !== Align.Left)) {
            const gap = (width - out.length);
            if (align === Align.Center) {
                for (let i = 0; i < (gap / 2); i++)
                    out = (' ' + out + ' ');
            } else if (align === Align.Right) {
                for (let i = 0; i < gap; i++)
                    out = (' ' + out);
            }
        }
        out = out.substr(0, width).padEnd(width, ' ');
        if (color !== undefined) {
            if (color === Color.Yellow) {
                out = yellow(out);
            } else if (color === Color.Green) {
                out = green(out);
            } else if (color === Color.Red) {
                out = red(out);
            }
        }
        this.write(out);
    }
    public break(): void {
        Deno.stdout.writeSync(new TextEncoder().encode('\n'));
        this._cursor = 0;
        this._lines += 1;
    }
    public rewind(): void {
        Deno.stdout.writeSync(new TextEncoder().encode(`\x1B[${this._lines}A`));
        Deno.stdout.writeSync(new TextEncoder().encode(`\x1B[${this._cursor}D`));
        this._cursor = 0;
        this._lines = 0;
    }
}

export interface IAppComponent {
    render(renderer: Renderer): void;
}

export class App {
    private _needsLine: boolean = true;
    private _renderer: Renderer = new Renderer();
    private _components: IAppComponent[] = [];
    public addTable(): Table {
        const table = new Table();
        this._components.push(table);
        return table;
    }
    public addLabel(): Label {
        const label = new Label();
        this._components.push(label);
        return label;
    }
    public addSeparator(): Separator {
        const separator = new Separator();
        this._components.push(separator);
        return separator;
    }
    public render(): void {
        if (this._needsLine) {
            console.log('');
            this._needsLine = false;
        }
        this._renderer.rewind();
        for (const component of this._components)
            component.render(this._renderer);
    }
}

export class Separator implements IAppComponent {
    public render(renderer: Renderer): void {
        renderer.writeValue('', 0, undefined, undefined);
        renderer.break();
    }
}

export class Label implements IAppComponent {
    public value?: string;
    public color?: Color;
    public width?: number;
    public render(renderer: Renderer): void {
        renderer.writeValue(this.value ?? '', this.width ?? 999, undefined, this.color);
        renderer.break();
    }
}

export const COLUMN_SEPARATOR = '  ';

export interface TableColumnOptions {
    name?: string;
    align?: Align;
    width?: number;
}

export interface ITableColumnFitOptions {
    minWidth?: number;
    maxWidth?: number;
}

export class TableColumn {
    private _table: Table;
    public name: string;
    public align: Align;
    public width: number;
    public constructor(table: Table, options?: TableColumnOptions) {
        this._table = table;
        this.name = (options?.name ?? 'Untitled');
        this.align = (options?.align ?? Align.Left);
        this.width = (options?.width ?? 8);
    }
    public autoFitContents(options?: ITableColumnFitOptions): void {
        this.width = this.name.length;
        for (const row of this._table.rows) {
            for (const cell of row.cells) {
                if (cell.column === this)
                    this.width = Math.max(this.width, cell.value.length);
            }
        }
        if (options?.minWidth !== undefined)
            this.width = Math.max(this.width, options.minWidth);
        if (options?.maxWidth !== undefined)
            this.width = Math.min(this.width, options.maxWidth);
    }
    public render(renderer: Renderer): void {
        renderer.writeValue(this.name, this.width, this.align, undefined);
        renderer.write(COLUMN_SEPARATOR);
    }
}

export class TableCell {
    private _row: TableRow;
    private _column: TableColumn;
    public value: string;
    public color: Color | undefined;
    public get column(): TableColumn {
        return this._column;
    }
    public constructor(row: TableRow, column: TableColumn, value?: string) {
        this._row = row;
        this._column = column;
        this.value = (value ?? '');
    }
    public render(renderer: Renderer) {
        renderer.writeValue(this.value, this.column.width, this.column.align, this.color);
        renderer.write(COLUMN_SEPARATOR);
    }
}

export class TableRow {
    private _table: Table;
    private _cells: TableCell[] = [];
    public get cells(): TableCell[] {
        return this._cells;
    }
    public constructor(table: Table) {
        this._table = table;
    }
    public addCell(column: TableColumn, value?: string): TableCell {
        if (this._cells.find(c => c.column == column))
            throw new Error('TableRow.addCell(): Cell for this column already added');
        this._cells.push(new TableCell(this, column, value));
        return this._cells[this._cells.length - 1];
    }
    public render(renderer: Renderer): void {
        for (const column of this._table.columns) {
            const cell: TableCell | undefined = this._cells.find(c => c.column == column);
            if (cell !== undefined) cell.render(renderer);
            else {
                renderer.writeValue('cell not found', column.width, undefined, undefined);
                renderer.write(COLUMN_SEPARATOR);
            }
        }
        renderer.break();
    }
}

export class Table implements IAppComponent {
    private _columns: TableColumn[] = [];
    private _rows: TableRow[] = [];
    private _renderHeader(renderer: Renderer): void {
        for (const column of this._columns)
            column.render(renderer);
        renderer.break();
    }
    private _renderSeparator(renderer: Renderer): void {
        for (const column of this._columns) {
            renderer.write(``.padEnd(column.width, '-'));
            if (column !== this._columns[this._columns.length -1])
                renderer.write(``.padEnd(COLUMN_SEPARATOR.length, '-'));
        }
        renderer.break();
    }
    private _renderRows(renderer: Renderer): void {
        for (const row of this._rows)
            row.render(renderer);
    }
    public get columns(): TableColumn[] {
        return this._columns;
    }
    public get rows(): TableRow[] {
        return this._rows;
    }
    public header: boolean = true;
    public addColumn(options?: TableColumnOptions): TableColumn {
        this._columns.push(new TableColumn(this, options));
        return this._columns[this._columns.length - 1];
    }
    public addRow(): TableRow {
        this._rows.push(new TableRow(this));
        return this._rows[this._rows.length - 1];
    }
    public render(renderer: Renderer): void {
        if (this.header) {
            this._renderHeader(renderer);
            this._renderSeparator(renderer);
        }
        this._renderRows(renderer);
    }
    public autoFitContents(): void {
        for (const column of this._columns)
            column.autoFitContents();
    }
}

export enum Standard {
    c89     = 'c89',
    c90     = 'c90',
    c99     = 'c99',
    c11     = 'c11',
    c17     = 'c17',
    gnu89   = 'gnu89',
    gnu90   = 'gnu90',
    gnu99   = 'gnu99',
    gnu11   = 'gnu11',
    gnu17   = 'gnu17',
    cxx98   = 'c++98',
    cxx03   = 'c++03',
    cxx11   = 'c++11',
    cxx14   = 'c++14',
    cxx17   = 'c++17',
    cxx2a   = 'c++2a',
    gnuxx98 = 'gnu++98',
    gnuxx03 = 'gnu++03',
    gnuxx11 = 'gnu++11',
    gnuxx14 = 'gnu++14',
    gnuxx17 = 'gnu++17',
    gnuxx2a = 'gnu++2a'
}

export interface IOptions {
    includePath?: string[];
    libraryPath?: string[];
    libraries?: string[];
    frameworks?: string[];
    standard?: Standard;
    objcARC?: boolean;
    macros?: string[];
    debug?: boolean;
    oLevel?: number;
    sanitizer?: boolean;
    errorLimit?: number;
    arguments?: string[];
}

export interface IResult {
    cmd: string[];
    code: number;
    stdout: string;
    stderr: string;
}

export async function run(cmd: string[], log?: boolean): Promise<IResult> {
    if (log === true) {
        const text: string = cmd.join(' ') + '\n';
        const path: string = Path.join(Path.resolve(Deno.cwd()), 'clang.log');
        Deno.writeFileSync(path, (new TextEncoder()).encode(text), { append: true });
    }

    const proc = Deno.run({ cmd, stderr: 'piped', stdout: 'piped' });
    const [ stderr, stdout, status ] = await Promise.all([ proc.stderrOutput(), proc.output(), proc.status() ]);

    return {
        cmd: cmd,
        code: status.code,
        stdout: new TextDecoder().decode(stdout).trim(),
        stderr: new TextDecoder().decode(stderr).trim()
    };
}

export async function clang(input: string[], output?: string, options?: IOptions, log?: boolean): Promise<IResult> {
    const cmd: string[] = ['clang'];
    if (options?.standard)
        cmd.push(`-std=${options.standard}`);
    if (options?.objcARC)
        cmd.push('-fobjc-arc');
    if (options?.debug)
        cmd.push('-g');
    if (options?.oLevel)
        cmd.push(`-O${options.oLevel.toString()}`);
    if (options?.sanitizer)
        cmd.push(`-fsanitize=address`);
    for (const path of (options?.includePath ?? []))
        cmd.push(`-I${Path.normalize(path)}`);
    for (const path of (options?.libraryPath ?? []))
        cmd.push(`-L${Path.normalize(path)}`);
    for (const library of (options?.libraries ?? []))
        cmd.push(`-l${library}`);
    for (const framework of (options?.frameworks ?? [])) {
        cmd.push('-framework');
        cmd.push(framework);
    }
    for (const macro of (options?.macros ?? []))
        cmd.push(`-D${macro}`);
    if (options?.errorLimit)
        cmd.push(`-ferror-limit=${options.errorLimit.toString()}`);
    for (const arg of (options?.arguments ?? []))
        cmd.push(arg);
    for (const path of input)
        cmd.push(path);
    if (output) {
        cmd.push(`-o`);
        cmd.push(output);
    }

    return run(cmd, log);
}

export async function llvmar(input: string[], output: string, log?: boolean): Promise<IResult> {
    return run(['llvm-ar', 'rc', output, ...input], log);
}

export interface IUnitInfo {
    modified: number;
    LOC: number;
    eLOC: number;
    size: number;
    deps: ({ path: string, modified: number })[];
}

export interface IUnitStatus {
    type: ('running' | 'error' | 'complete');
    action?: ('skip' | 'compile');
    mmTime?: number;
    LOC?: number;
    eLOC?: number;
    eTime?: number;
    cTime?: number;
    time?: number;
    size?: number;
    stdout?: string;
    stderr?: string;
}

export interface IUnitMakeOptions {
    log?: boolean;
}

export class Unit {
    private _onError: ((status: IUnitStatus) => void)[] = [];
    private _onStatus: ((status: IUnitStatus) => void)[] = [];
    private _onComplete: ((status: IUnitStatus) => void)[] = [];
    private _triggerError(status: IUnitStatus): void {
        for (const subscribtion of this._onError)
            subscribtion.call(undefined, status);
    }
    private _triggerStatus(status: IUnitStatus): void {
        for (const subscribtion of this._onStatus)
            subscribtion.call(undefined, status);
    }
    private _triggerComplete(status: IUnitStatus): void {
        for (const subscribtion of this._onComplete)
        subscribtion.call(undefined, status);
    }
    public input?: string;
    public output?: string;
    public clean?: boolean;
    public includePath?: string[];
    public libraryPath?: string[];
    public libraries?: string[];
    public frameworks?: string[];
    public standard?: Standard;
    public objcARC?: boolean;
    public macros?: string[];
    public debug?: boolean;
    public oLevel?: number;
    public sanitizer?: boolean;
    public errorLimit?: number;
    public arguments?: string[];
    public temp?: string;
    public onError(fn: (state: IUnitStatus) => void): void {
        this._onError.push(fn);
    }
    public onStatus(fn: (state: IUnitStatus) => void): void {
        this._onStatus.push(fn);
    }
    public onComplete(fn: (state: IUnitStatus) => void): void {
        this._onComplete.push(fn);
    }
    public async make(options?: IUnitMakeOptions): Promise<IUnitStatus> {
        const status: IUnitStatus = { type: 'running', stdout: '', stderr: '' };
        if (this.input === undefined) {
            status.type = 'error';
            status.stderr += 'build-system: error: Input sources not specified (unit.input = \'path/to/input/file\')\n';
            this._triggerError(status);
            return status;
        }
        const inputPath: string = Path.resolve(this.input);
        const inputStat: IStat = stat(inputPath);
        if (!inputStat.exists) {
            status.type = 'error';
            status.stderr += `build-system: error: File "${inputPath}" not found\n`;
            this._triggerError(status);
            return status;
        }
        if (inputStat.isDirectory) {
            status.type = 'error';
            status.stderr += `build-system: error: File "${inputPath}" is directory\n`;
            this._triggerError(status);
            return status;
        }
        const relPath: string = (() => {
            const __ret: string = Path.relative(Deno.cwd(), Path.resolve(inputPath));
            if (__ret.includes('..')) return (Deno.build.os == 'windows')
                                            ? Path.resolve(__ret).split(':')[1]
                                            : Path.resolve(__ret);
            else return __ret;
        })();

        const outDir: string = (this.temp !== undefined)
                                ? Path.resolve(this.temp)
                                : Path.resolve(Path.join(tempPath(), 'clang-build-system', dirName()));
        const outSrcPath: string = Path.resolve(Path.join(outDir, relPath));
        const outSrcDir: string = Path.dirname(outSrcPath);
        const outInfoPath: string = `${outSrcPath}.json`;
        const outPrepPath: string = `${outSrcPath}.prep`;
        const outObjPath: string = `${outSrcPath}.o`;

        const __time_Unit = timeNow();
        const __time_MM = timeNow();

        const res1 = await clang(
            [this.input],
            undefined,
            {
                arguments: ['-MM', ...(this.arguments ?? [])],
                includePath: this.includePath,
                macros: this.macros
            },
            options?.log
        );
        status.stderr += res1.stderr;

        if (res1.code !== 0) {
            status.type = 'error';
            this._triggerError(status);
            return status;
        }

        status.mmTime = (timeNow() - __time_MM);
        this._triggerStatus(status);

        const info: IUnitInfo = { deps: [], LOC: 0, eLOC: 0, size: 0, modified: inputStat.modified };
        const prev: IUnitInfo = { deps: [], LOC: 0, eLOC: 0, size: 0, modified: 0 };
        const lines: string[] = res1.stdout.trim()
                                            .replaceAll('\\\r\n', '')
                                            .replaceAll('\\\n', '')
                                            .split(' ')
                                            .slice(2)
                                            .filter(a => a.trim().length > 0);
        for (const line of lines) {
            const path = Path.resolve(line);
            const stat_ = stat(path);
            if (!stat_.exists) {
                status.type = 'error';
                status.stderr += `build-system: error: File "${path}" not found\n`;
                this._triggerError(status);
                return status;
            }
            if (!info.deps.some(a => a.path === path))
                info.deps.push({ path, modified: stat_.modified });
        }

        if (stat(outInfoPath).exists) {
            try {
                const json = JSON.parse(new TextDecoder().decode(await Deno.readFile(outInfoPath)));
                prev.modified = json['modified'] ?? 0;
                prev.eLOC = json['eLOC'] ?? 0;
                prev.LOC = json['LOC'] ?? 0;
                prev.size = json['size'] ?? 0;
                if (Array.isArray(json['deps'])) {
                    for (const dep of json['deps']) {
                        if ((dep['path'] !== undefined)
                        && (dep['modified'] !== undefined))
                            prev.deps.push(dep);
                    }
                }
            } catch (e) {
                status.type = 'error';
                status.stderr += `build-system: error: ${e.message || e.toString()}\n`;
                this._triggerError(status);
                return status;
            }
        }

        if (info.modified === prev.modified) {
            if (info.deps.length === prev.deps.length) {
                status.action = 'skip';
                for (let i = 0; i < info.deps.length; i++) {
                    if ((info.deps[i].path !== prev.deps[i].path)
                    || (info.deps[i].modified !== prev.deps[i].modified)) {
                        status.action = 'compile';
                        break;
                    }
                }
            } else status.action = 'compile';
        } else status.action = 'compile';

        const outPrepPathStat = stat(outPrepPath);
        const outObjPathStat = stat(outObjPath);
        if (!outPrepPathStat.exists) status.action = 'compile';
        if (!outObjPathStat.exists) status.action = 'compile';
        if (this.clean === true) status.action = 'compile';

        this._triggerStatus(status);

        if (status.action === 'compile') {
            if (outPrepPathStat.exists) await Deno.remove(outPrepPath);
            if (outObjPathStat.exists) await Deno.remove(outObjPath);
            if (!stat(outDir).exists) await Deno.mkdir(outDir, { recursive: true });
            if (!stat(outSrcDir).exists) await Deno.mkdir(outSrcDir, { recursive: true });

            info.LOC = (new TextDecoder().decode(await Deno.readFile(inputPath))).split('\n').length;

            status.LOC = info.LOC;
            this._triggerStatus(status);

            const __time_E = timeNow();

            const res2 = await clang(
                [inputPath],
                outPrepPath,
                {
                    arguments: ['-E', ...(this.arguments ?? [])],
                    includePath: this.includePath,
                    macros: this.macros
                },
                options?.log
            );
            status.stdout += res2.stdout;
            status.stderr += res2.stderr;

            if (res2.code !== 0) {
                status.type = 'error';
                this._triggerError(status);
                return status;
            }

            status.eTime = (timeNow() - __time_E);
            this._triggerStatus(status);

            info.eLOC = (new TextDecoder().decode(await Deno.readFile(outPrepPath))).split('\n').length;

            status.eLOC = info.eLOC;
            this._triggerStatus(status);

            const __time_C = timeNow();

            const res3 = await clang(
                [inputPath],
                outObjPath,
                {
                    arguments: ['-c', ...(this.arguments ?? [])],
                    includePath: this.includePath,
                    standard: this.standard,
                    objcARC: this.objcARC,
                    macros: this.macros,
                    debug: this.debug,
                    oLevel: this.oLevel,
                    sanitizer: this.sanitizer,
                    errorLimit: this.errorLimit
                },
                options?.log
            );
            status.stdout += res3.stdout;
            status.stderr += res3.stderr;

            if (res3.code !== 0) {
                status.type = 'error';
                this._triggerError(status);
                return status;
            }

            status.cTime = (timeNow() - __time_C);
            this._triggerStatus(status);

            info.size = stat(outObjPath).size;
            status.size = info.size;
            this._triggerStatus(status);

            await Deno.writeFile(outInfoPath, new TextEncoder().encode(JSON.stringify(info)));
        } else {
            info.LOC = prev.LOC;
            info.eLOC = prev.eLOC;
            info.size = prev.size;
            status.LOC = info.LOC;
            status.eLOC = info.eLOC;
            status.size = info.size;
            this._triggerStatus(status);
        }

        if (this.output !== undefined) {
            const outputPath: string = Path.resolve(this.output);
            const outputDir: string = Path.dirname(outputPath);

            if (!stat(outputDir).exists)
                await Deno.mkdir(outputDir, { recursive: true });

            await Deno.copyFile(outObjPath, outputPath);
        }

        status.type = 'complete';
        status.time = (timeNow() - __time_Unit);
        this._triggerStatus(status);
        this._triggerComplete(status);
        return status;
    }
}

export interface ILinkStatus {
    type: ('running' | 'error' | 'complete');
    time?: number;
    size?: number;
    stdout?: string;
    stderr?: string;
}

export interface ILinkMakeOptions {
    log?: boolean;
}

export class Link {
    private _onError: ((status: ILinkStatus) => void)[] = [];
    private _onComplete: ((status: ILinkStatus) => void)[] = [];
    private _triggerError(status: ILinkStatus): void {
        for (const subscribtion of this._onError)
            subscribtion.call(undefined, status);
    }
    private _triggerComplete(status: ILinkStatus): void {
        for (const subscribtion of this._onComplete)
        subscribtion.call(undefined, status);
    }
    public output?: string;
    public input: string[] = [];
    public includePath?: string[];
    public libraryPath?: string[];
    public libraries?: string[];
    public frameworks?: string[];
    public standard?: Standard;
    public objcARC?: boolean;
    public macros?: string[];
    public debug?: boolean;
    public oLevel?: number;
    public sanitizer?: boolean;
    public errorLimit?: number;
    public arguments?: string[];
    public onError(fn: (state: ILinkStatus) => void): void {
        this._onError.push(fn);
    }
    public onComplete(fn: (state: ILinkStatus) => void): void {
        this._onComplete.push(fn);
    }
    async make(options?: ILinkMakeOptions): Promise<ILinkStatus> {
        const status: ILinkStatus = { type: 'running', stdout: '', stderr: '' };
        const input: string[] = [];
        for (const path of this.input) {
            const p = Path.resolve(path);
            if (!stat(p).isFile) {
                status.type = 'error';
                status.stderr += `build-system: error: File "${p}" not found\n`;
                this._triggerError(status);
                return status;
            }
            input.push(p);
        }

        if (input.length === 0) {
            status.type = 'error';
            status.stderr += 'build-system: error: At least one input is required (link.input = [\'path/to/some/file\'])\n';
            this._triggerError(status);
            return status;
        }

        if (this.output === undefined) {
            status.type = 'error';
            status.stderr += 'build-system: error: Output destination not specified (link.output = \'path/to/output/file\')\n';
            this._triggerError(status);
            return status;
        }
        const output = Path.resolve(this.output);

        const __time = timeNow();

        const res = await clang(
            input,
            output,
            {
                includePath: this.includePath,
                libraryPath: this.libraryPath,
                libraries: this.libraries,
                frameworks: this.frameworks,
                standard: this.standard,
                objcARC: this.objcARC,
                macros: this.macros,
                debug: this.debug,
                oLevel: this.oLevel,
                sanitizer: this.sanitizer,
                errorLimit: this.errorLimit,
                arguments: this.arguments
            },
            options?.log
        );
        status.stdout += res.stdout;
        status.stderr += res.stderr;

        if (res.code !== 0) {
            status.type = 'error';
            this._triggerError(status);
            return status;
        }

        status.type = 'complete';
        status.time = (timeNow() - __time);
        status.size = stat(this.output).size;
        this._triggerComplete(status);
        return status;
    }
}

export interface IArchStatus {
    type: ('running' | 'error' | 'complete');
    time?: number;
    size?: number;
    stdout?: string;
    stderr?: string;
}

export interface IArchMakeOptions {
    log?: boolean;
}

export class Arch {
    private _onError: ((status: IArchStatus) => void)[] = [];
    private _onComplete: ((status: IArchStatus) => void)[] = [];
    private _triggerError(status: IArchStatus): void {
        for (const subscribtion of this._onError)
            subscribtion.call(undefined, status);
    }
    private _triggerComplete(status: IArchStatus): void {
        for (const subscribtion of this._onComplete)
        subscribtion.call(undefined, status);
    }
    public output?: string;
    public input: string[] = [];
    public onError(fn: (state: IArchStatus) => void): void {
        this._onError.push(fn);
    }
    public onComplete(fn: (state: IArchStatus) => void): void {
        this._onComplete.push(fn);
    }
    async make(options?: IArchMakeOptions): Promise<IArchStatus> {
        const status: IArchStatus = { type: 'running', stdout: '', stderr: '' };
        const input: string[] = [];
        for (const path of this.input) {
            const p = Path.resolve(path);
            if (!stat(p).isFile) {
                status.type = 'error';
                status.stderr += `build-system: error: File "${p}" not found\n`;
                this._triggerError(status);
                return status;
            }
            input.push(p);
        }

        if (input.length === 0) {
            status.type = 'error';
            status.stderr += 'build-system: error: At least one input is required (arch.input = [\'path/to/some/file\'])\n';
            this._triggerError(status);
            return status;
        }

        if (this.output === undefined) {
            status.type = 'error';
            status.stderr += 'build-system: error: Output destination not specified (arch.output = \'path/to/output/file\')\n';
            this._triggerError(status);
            return status;
        }
        const output = Path.resolve(this.output);

        const __time = timeNow();

        const res = await llvmar(
            input,
            output,
            options?.log
        );
        status.stdout += res.stdout;
        status.stderr += res.stderr;

        if (res.code !== 0) {
            status.type = 'error';
            this._triggerError(status);
            return status;
        }

        status.type = 'complete';
        status.time = (timeNow() - __time);
        status.size = stat(this.output).size;
        this._triggerComplete(status);
        return status;
    }
}

export interface ITargetObject {
    path: string;
    status: IUnitStatus;
}

export interface ITargetStatus {
    type: ('running' | 'error' | 'complete');
    time?: number;
    size?: number;
    stdout?: string;
    stderr?: string;
}

export interface ITargetMakeOptions {
    output?: boolean;
    threads?: number;
    log?: boolean;
}

export enum TargetType {
    executable = 'executable',
    library    = 'library'
}

export class Target {
    private _onError: ((status: ITargetStatus) => void)[] = [];
    private _onComplete: ((status: ITargetStatus) => void)[] = [];
    private _triggerError(status: ITargetStatus): void {
        for (const subscribtion of this._onError)
            subscribtion.call(undefined, status);
    }
    private _triggerComplete(status: ITargetStatus): void {
        for (const subscribtion of this._onComplete)
        subscribtion.call(undefined, status);
    }
    private _outputStatus(status: ITargetStatus): void {
        const out: string = (status.stderr + '\n' + status.stdout).split('\n')
                            .map(a => a.trim())
                            .filter(a => a.length !== 0)
                            .join('\n')
                            .replaceAll('error:', red('error:'))
                            .replaceAll('warning:', yellow('warning:'));
        console.log((out.length > 0) ? `\n${out}\n` : '\n');
    }
    public type: TargetType = TargetType.executable;
    public sources: string[] = [];
    public output?: string;
    public includePath?: string[];
    public libraryPath?: string[];
    public libraries?: string[];
    public frameworks?: string[];
    public cStandard?: Standard;
    public cppStandard?: Standard;
    public objcARC?: boolean;
    public macros?: string[];
    public debug?: boolean;
    public oLevel?: number;
    public sanitizer?: boolean;
    public errorLimit?: number;
    public arguments?: string[];
    public temp?: string;
    public clean: boolean = false;
    public onError(fn: (state: IUnitStatus) => void): void {
        this._onError.push(fn);
    }
    public onComplete(fn: (state: IUnitStatus) => void): void {
        this._onComplete.push(fn);
    }
    async make(options?: ITargetMakeOptions): Promise<ITargetStatus> {
        const status: ITargetStatus = { type: 'running', stdout: '', stderr: '' };
        const sources: string[] = [];

        if (this.output === undefined) {
            status.type = 'error';
            status.stderr += 'build-system: error: Output file not specified (target.output = \'path/to/output/file\')\n';
            this._triggerError(status);
            if (options?.output === true)
                this._outputStatus(status);
            return status;
        }

        const output: string = Path.resolve(this.output);

        if (this.sources.length === 0) {
            status.type = 'error';
            status.stderr += 'build-system: error: At least one source is required (target.sources = [\'path/to/some/source\'])\n';
            this._triggerError(status);
            if (options?.output === true)
                this._outputStatus(status);
            return status;
        }

        for (const path of this.sources) {
            const p: string = Path.resolve(path);
            if (!stat(p).exists) {
                status.type = 'error';
                status.stderr += `build-system: error: File "${p}" not found\n`;
                this._triggerError(status);
                if (options?.output === true)
                    this._outputStatus(status);
                return status;
            }
            sources.push(p);
        }

        let __seq = 1;

        const tempDir: string = (this.temp !== undefined)
                                ? Path.resolve(this.temp)
                                : Path.join(Path.dirname(output), 'temp');
        const batches: string[][] = ((): string[][] => {
            const ret: string[][] = [];
            const input: string[] = sources;
            while (input.length > 0)
                ret.push(input.splice(0, options?.threads ?? 4));
            return ret;
        })();
        const objects: ITargetObject[] = [];

        for (const batch of batches) {
            const app = new App();

            const table = app.addTable();
            table.header = (batch === batches[0]);
            const fileNameColumn = table.addColumn({ name: 'File Name', width: 16 });
            const mmTimeColumn = table.addColumn({ name: '-MM Time', align: Align.Center });
            const actionColumn = table.addColumn({ name: 'Action', width: 7 });
            const locColumn = table.addColumn({ name: 'LOC', width: 6, align: Align.Right });
            const eTimeColumn = table.addColumn({ name: '-E Time', align: Align.Right });
            const locEColumn = table.addColumn({ name: 'LOC (-E)', align: Align.Right });
            const cTimeColumn = table.addColumn({ name: '-c Time', align: Align.Right });
            const timeColumn = table.addColumn({ name: 'TU Time', align: Align.Right });
            const sizeColumn = table.addColumn({ name: 'TU Size', align: Align.Right });

            const promises: Promise<void>[] = [];

            for (const path of batch) {
                const row = table.addRow();
                const nameCell = row.addCell(fileNameColumn, Path.basename(path));
                const mmTimeCell = row.addCell(mmTimeColumn);
                const actionCell = row.addCell(actionColumn);
                const locCell = row.addCell(locColumn);
                const eTimeCell = row.addCell(eTimeColumn);
                const locECell = row.addCell(locEColumn);
                const cTimeCell = row.addCell(cTimeColumn);
                const timeCell = row.addCell(timeColumn);
                const sizeCell = row.addCell(sizeColumn);

                const updateRow = (status: IUnitStatus): void => {
                    mmTimeCell.value = status.mmTime ? timeFormat(status.mmTime ?? 0) : '-';
                    actionCell.value = status.action?.toString() ?? '-';
                    locCell.value = status.LOC ? numberFormat(status.LOC ?? 0) : '-';
                    eTimeCell.value = status.eTime ? timeFormat(status.eTime ?? 0) : '-';
                    locECell.value = status.eLOC ? numberFormat(status.eLOC ?? 0) : '-';
                    cTimeCell.value = status.cTime ? timeFormat(status.cTime ?? 0) : '-';
                    timeCell.value = status.time ? timeFormat(status.time ?? 0) : '-';
                    sizeCell.value = status.size ? (status.size / 1024 / 1024).toFixed(2) + ' MB' : '-';

                    if (status.type === 'error')
                        nameCell.color = Color.Red;

                    if (options?.output === true)
                        app.render();
                }

                const unit: Unit = new Unit();
                unit.onStatus(updateRow);
                unit.onComplete(updateRow);
                unit.onError(updateRow);
                unit.includePath = this.includePath;
                unit.libraryPath = this.libraryPath;
                unit.libraries = this.libraries;
                unit.frameworks = this.frameworks;
                unit.standard = (() => {
                    const ext = Path.extname(path);
                    if (['.c'].includes(ext)) return this.cStandard;
                    else if (['.cc', '.cpp', '.cxx', '.c++'].includes(ext)) return this.cppStandard;
                    else return undefined;
                })();
                unit.objcARC = this.objcARC;
                unit.macros = this.macros;
                unit.debug = this.debug;
                unit.oLevel = this.oLevel;
                unit.sanitizer = this.sanitizer;
                unit.errorLimit = this.errorLimit;
                unit.arguments = this.arguments;
                unit.input = path;
                unit.output = Path.join(tempDir, `${__seq++}_${Path.basename(path)}.o`);
                unit.temp = Path.join(tempDir);
                unit.clean = this.clean;

                promises.push((async () => {
                    objects.push({
                        path: <string>unit.output,
                        status: await unit.make({ log: options?.log })
                    });
                })());
            }

            if (options?.output === true)
                app.render();

            await Promise.all(promises);
        }

        let errors: boolean = false;

        for (const object of objects) {
            status.stderr += object.status.stderr ?? '';
            status.stdout += object.status.stdout ?? '';
            if (object.status.type === 'error')
                errors = true;
        }

        if (errors) {
            status.type = 'error';
            this._triggerError(status);
            if (options?.output === true)
                this._outputStatus(status);
            return status;
        }

        console.log('');

        const app = new App();

        const table = app.addTable();

        const nameColumn = table.addColumn({ name: 'File Name', width: 18 });
        const timeColumn = table.addColumn({ name: 'Time', align: Align.Right });
        const sizeColumn = table.addColumn({ name: 'Size', align: Align.Right });

        const row = table.addRow();

        const nameCell = row.addCell(nameColumn, Path.basename(this.output));
        const timeCell = row.addCell(timeColumn, '-');
        const sizeCell = row.addCell(sizeColumn, '-');

        let res: ILinkStatus | IArchStatus | undefined;

        if (this.type === TargetType.executable) {
            const link = new Link();
            link.includePath = this.includePath;
            link.libraryPath = this.libraryPath;
            link.libraries = this.libraries;
            link.frameworks = this.frameworks;
            link.objcARC = this.objcARC;
            link.macros = this.macros;
            link.debug = this.debug;
            link.oLevel = this.oLevel;
            link.sanitizer = this.sanitizer;
            link.errorLimit = this.errorLimit;
            link.arguments = this.arguments;
            link.input = objects.map(u => u.path);
            link.output = this.output;
            link.onError(status => {
                nameCell.color = Color.Red;
                app.render();
            });
            link.onComplete(status => {
                timeCell.value = timeFormat(status.time ?? 0);
                sizeCell.value = ((status.size ?? 0) / 1024 / 1024).toFixed(2) + ' MB';
                app.render();
            });

            res = await link.make({ log: options?.log });

        } else if (this.type === TargetType.library) {
            const arch = new Arch();
            arch.input = objects.map(u => u.path);
            arch.output = this.output;
            arch.onError(status => {
                nameCell.color = Color.Red;
                app.render();
            });
            arch.onComplete(status => {
                timeCell.value = timeFormat(status.time ?? 0);
                sizeCell.value = ((status.size ?? 0) / 1024 / 1024).toFixed(2) + ' MB';
                app.render();
            });

            res = await arch.make({ log: options?.log });
        } else {
            status.type = 'error';
            status.stderr += 'build-system: error: Target type not specified (target.type = TargetType.executable)\n';
            this._triggerError(status);
            if (options?.output === true)
                this._outputStatus(status);
            return status;
        }

        status.stderr += res.stderr ?? '';
        status.stdout += res.stdout ?? '';

        if (res.type === 'error') {
            status.type = 'error';
            this._triggerError(status);
            if (options?.output === true)
                this._outputStatus(status);
            return status;
        }

        if (options?.output === true)
            this._outputStatus(status);

        status.type = 'complete';
        this._triggerComplete(status);
        return status;
    }
}