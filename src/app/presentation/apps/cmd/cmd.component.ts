import {
  Component, signal, ViewChild, ElementRef,
  AfterViewChecked, HostListener, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileSystemService } from '../../../infrastructure/adapters/file-system.service';

interface CmdLine {
  text: string;
  type: 'output' | 'input' | 'error' | 'success' | 'system';
}

@Component({
  selector: 'app-cmd',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cmd.component.html',
  styleUrl: './cmd.component.css',
})
export class CmdComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('inputEl') inputEl!: ElementRef;

  private readonly fs = inject(FileSystemService);

  lines = signal<CmdLine[]>([]);
  currentInput = signal('');
  currentPath = signal('C:\\Users\\User');
  history: string[] = [];
  historyIndex = -1;
  bgColor = signal('#1a1a1a');
  textColor = signal('#ffffff');
  private windowTitle = 'Command Prompt';

  private envVars: Record<string, string> = {
    'ALLUSERSPROFILE': 'C:\\ProgramData',
    'APPDATA': 'C:\\Users\\User\\AppData\\Roaming',
    'COMPUTERNAME': 'WINDOWS7-PC',
    'HOMEDRIVE': 'C:',
    'HOMEPATH': '\\Users\\User',
    'LOCALAPPDATA': 'C:\\Users\\User\\AppData\\Local',
    'LOGONSERVER': '\\\\WINDOWS7-PC',
    'NUMBER_OF_PROCESSORS': '4',
    'OS': 'Windows_NT',
    'PATHEXT': '.COM;.EXE;.BAT;.CMD;.VBS;.JS',
    'PROCESSOR_ARCHITECTURE': 'AMD64',
    'PROCESSOR_IDENTIFIER': 'Intel64 Family 6 Model 60 Stepping 3',
    'PROCESSOR_LEVEL': '6',
    'PROCESSOR_REVISION': '3c03',
    'PROGRAMDATA': 'C:\\ProgramData',
    'PROGRAMFILES': 'C:\\Program Files',
    'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
    'SYSTEMDRIVE': 'C:',
    'SYSTEMROOT': 'C:\\Windows',
    'TEMP': 'C:\\Users\\User\\AppData\\Local\\Temp',
    'TMP': 'C:\\Users\\User\\AppData\\Local\\Temp',
    'USERNAME': 'User',
    'USERPROFILE': 'C:\\Users\\User',
    'WINDIR': 'C:\\Windows',
  };

  private networkAdapters = [
    {
      name: 'Ethernet adapter Local Area Connection',
      dns: 'localdomain',
      ipv4: '192.168.1.100',
      ipv6: 'fe80::1c2d:3e4f:5a6b:7c8d%11',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      dhcp: '192.168.1.1',
      dns1: '8.8.8.8',
      dns2: '8.8.4.4',
      mac: '4A-2B-3C-8D-1E-5F',
    },
    {
      name: 'Wireless LAN adapter Wi-Fi',
      dns: '',
      ipv4: '192.168.0.105',
      ipv6: 'fe80::9a8b:7c6d:5e4f:3a2b%14',
      subnet: '255.255.255.0',
      gateway: '192.168.0.1',
      dhcp: '192.168.0.1',
      dns1: '8.8.8.8',
      dns2: '1.1.1.1',
      mac: 'B8-27-EB-1A-2C-3D',
    },
  ];

  constructor() {
    this.printWelcome();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private printWelcome(): void {
    this.addLines([
      { text: 'Microsoft Windows [Version 6.1.7601]', type: 'output' },
      { text: 'Copyright (c) 2009 Microsoft Corporation. All rights reserved.', type: 'output' },
      { text: '', type: 'output' },
    ]);
  }

  private addLines(newLines: CmdLine[]): void {
    this.lines.update(l => [...l, ...newLines]);
  }

  private addLine(text: string, type: CmdLine['type'] = 'output'): void {
    this.lines.update(l => [...l, { text, type }]);
  }

  get prompt(): string {
    return `${this.currentPath()}>`;
  }

  onEnter(): void {
    const input = this.currentInput().trim();
    this.addLine(`${this.prompt}${input}`, 'input');
    if (input) {
      this.history.unshift(input);
      if (this.history.length > 100) this.history.pop();
      this.historyIndex = -1;
      this.executeCommand(input);
    } else {
      this.addLine('');
    }
    this.currentInput.set('');
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.currentInput.set(this.history[this.historyIndex]);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.currentInput.set(this.history[this.historyIndex]);
      } else {
        this.historyIndex = -1;
        this.currentInput.set('');
      }
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.autocomplete();
    } else if (event.ctrlKey && event.key === 'c') {
      this.addLine('^C', 'error');
      this.currentInput.set('');
    }
  }

  private autocomplete(): void {
    const input = this.currentInput();
    const parts = input.split(' ');
    const partial = parts[parts.length - 1].toLowerCase();
    const entries = this.fs.getEntries(this.currentPath());
    const match = entries.find(e => e.name.toLowerCase().startsWith(partial));
    if (match) {
      parts[parts.length - 1] = match.name.includes(' ') ? `"${match.name}"` : match.name;
      this.currentInput.set(parts.join(' '));
    }
  }

  private resolvePath(arg: string): string {
    if (!arg) return this.currentPath();
    if (arg.includes(':')) return arg.replace(/\//g, '\\');
    if (arg.startsWith('\\')) return `C:${arg}`;
    return `${this.currentPath()}\\${arg}`;
  }

  private executeCommand(raw: string): void {
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const rawArgs = raw.substring(parts[0].length).trim();

    switch (cmd) {
      case 'help': this.cmdHelp(args); break;
      case 'cls': this.lines.set([]); return;
      case 'echo': this.cmdEcho(args, rawArgs); break;
      case 'dir': this.cmdDir(args); break;
      case 'cd':
      case 'chdir': this.cmdCd(args); break;
      case 'md':
      case 'mkdir': this.cmdMkdir(args); break;
      case 'rd':
      case 'rmdir': this.cmdRmdir(args); break;
      case 'del':
      case 'erase': this.cmdDel(args); break;
      case 'type': this.cmdType(args); break;
      case 'copy': this.cmdCopy(args); break;
      case 'move': this.cmdMove(args); break;
      case 'ren':
      case 'rename': this.cmdRen(args); break;
      case 'set': this.cmdSet(args); break;
      case 'setx': this.cmdSetx(args); break;
      case 'date': this.cmdDate(args); break;
      case 'time': this.cmdTime(args); break;
      case 'ver': this.addLine('Microsoft Windows [Version 6.1.7601]'); break;
      case 'ipconfig': this.cmdIpconfig(args); break;
      case 'ping': this.cmdPing(args); break;
      case 'tracert': this.cmdTracert(args); break;
      case 'nslookup': this.cmdNslookup(args); break;
      case 'netstat': this.cmdNetstat(args); break;
      case 'net': this.cmdNet(args); break;
      case 'arp': this.cmdArp(args); break;
      case 'route': this.cmdRoute(args); break;
      case 'systeminfo': this.cmdSysteminfo(); break;
      case 'tasklist': this.cmdTasklist(args); break;
      case 'taskkill': this.cmdTaskkill(args); break;
      case 'sc': this.cmdSc(args); break;
      case 'reg': this.cmdReg(args); break;
      case 'sfc': this.cmdSfc(args); break;
      case 'chkdsk': this.cmdChkdsk(args); break;
      case 'format': this.cmdFormat(args); break;
      case 'diskpart': this.addLine('DISKPART requires elevated privileges.', 'error'); break;
      case 'color': this.cmdColor(args); break;
      case 'title': this.cmdTitle(args); break;
      case 'mode': this.cmdMode(args); break;
      case 'prompt': this.cmdPrompt(args); break;
      case 'whoami': this.cmdWhoami(args); break;
      case 'hostname': this.addLine(this.envVars['COMPUTERNAME']); break;
      case 'path': this.addLine(this.envVars['USERPROFILE']); break;
      case 'tree': this.cmdTree(args); break;
      case 'attrib': this.cmdAttrib(args); break;
      case 'find': this.cmdFind(args); break;
      case 'findstr': this.cmdFindstr(args); break;
      case 'sort': this.addLine('Sorts input. Redirect a file to sort it.'); break;
      case 'more': this.cmdMore(args); break;
      case 'fc': this.cmdFc(args); break;
      case 'comp': this.addLine('Compares the contents of two files or sets of files.'); break;
      case 'xcopy': this.cmdXcopy(args); break;
      case 'robocopy': this.addLine('Robust File Copy for Windows.', 'success'); break;
      case 'assoc': this.cmdAssoc(args); break;
      case 'ftype': this.cmdFtype(args); break;
      case 'start': this.cmdStart(args); break;
      case 'runas': this.addLine('runas: Access denied.', 'error'); break;
      case 'shutdown': this.cmdShutdown(args); break;
      case 'logoff': this.addLine('Logging off...', 'system'); break;
      case 'lock': this.addLine('Locking workstation...', 'system'); break;
      case 'exit': this.addLine('Use the X button to close this window.'); break;
      case 'pause': this.addLine('Press any key to continue . . .'); break;
      case 'call': this.addLine(`Calling: ${args.join(' ')}`); break;
      case 'goto': this.addLine(`goto: label not found - ${args[0]}`, 'error'); break;
      case 'if': this.cmdIf(args); break;
      case 'for': this.addLine('FOR loop executed.'); break;
      case 'wmic': this.cmdWmic(args); break;
      case 'powershell':
      case 'pwsh': this.addLine('Windows PowerShell', 'system'); this.addLine('Copyright (C) 2009 Microsoft Corporation. All rights reserved.'); break;
      case 'notepad': this.addLine('Opening Notepad...', 'success'); break;
      case 'calc': this.addLine('Opening Calculator...', 'success'); break;
      case 'mspaint': this.addLine('Opening Paint...', 'success'); break;
      case 'mstsc': this.addLine('Remote Desktop Connection is not available.', 'error'); break;
      case 'regedit': this.addLine('Registry Editor requires elevated privileges.', 'error'); break;
      case 'msconfig': this.addLine('System Configuration requires elevated privileges.', 'error'); break;
      case 'control': this.addLine('Opening Control Panel...', 'success'); break;
      case 'winver': this.cmdWinver(); break;
      case 'clip': this.addLine('Output piped to clipboard.', 'success'); break;
      case 'cipher': this.cmdCipher(args); break;
      case 'compact': this.addLine('Displaying or altering the compression of files.'); break;
      case 'convert': this.addLine('Converts FAT volumes to NTFS.', 'system'); break;
      case 'driverquery': this.cmdDriverquery(); break;
      case 'getmac': this.cmdGetmac(); break;
      case 'gpresult': this.addLine('Group Policy result requires elevated privileges.', 'error'); break;
      case 'gpupdate': this.addLine('Updating Group Policy...', 'success'); this.addLine('Computer Policy update has completed successfully.', 'success'); break;
      case 'icacls': this.cmdIcacls(args); break;
      case 'mklink': this.cmdMklink(args); break;
      case 'subst': this.cmdSubst(args); break;
      case 'vol': this.cmdVol(args); break;
      case 'label': this.addLine('Volume in drive C is unlabeled.'); break;
      case 'w32tm': this.addLine('Windows Time service is running.', 'success'); break;
      case 'net1': this.cmdNet(args); break;
      case '': break;
      default:
        this.addLine(`'${parts[0]}' is not recognized as an internal or external command,`, 'error');
        this.addLine('operable program or batch file.', 'error');
    }
    this.addLine('');
  }

  private cmdHelp(args: string[]): void {
    if (args[0]) {
      const helpTexts: Record<string, string[]> = {
        'cd': ['Displays the name of or changes the current directory.', '', 'CD [/D] [drive:][path]', 'CD [..]', '', '  ..   Specifies that you want to change to the parent directory.'],
        'dir': ['Displays a list of files and subdirectories in a directory.', '', 'DIR [drive:][path][filename] [/A] [/B] [/S]'],
        'copy': ['Copies one or more files to another location.', '', 'COPY source destination'],
        'del': ['Deletes one or more files.', '', 'DEL [/F] [/S] [/Q] names'],
        'ipconfig': ['Displays all current TCP/IP network configuration values.', '', 'IPCONFIG [/all] [/flushdns]'],
      };
      const help = helpTexts[args[0].toLowerCase()];
      if (help) help.forEach(line => this.addLine(line));
      else this.addLine(`This command is not supported by the help utility.`, 'error');
      return;
    }
    const commands = [
      ['ASSOC','Displays or modifies file extension associations.'],
      ['ATTRIB','Displays or changes file attributes.'],
      ['CD','Displays the name of or changes the current directory.'],
      ['CHKDSK','Checks a disk and displays a status report.'],
      ['CLS','Clears the screen.'],
      ['COLOR','Sets the default console foreground and background colors.'],
      ['COPY','Copies one or more files to another location.'],
      ['DATE','Displays or sets the date.'],
      ['DEL','Deletes one or more files.'],
      ['DIR','Displays a list of files and subdirectories in a directory.'],
      ['ECHO','Displays messages, or turns command echoing on or off.'],
      ['EXIT','Quits the CMD.EXE program.'],
      ['FC','Compares two files or sets of files, and displays differences.'],
      ['FIND','Searches for a text string in a file or files.'],
      ['FINDSTR','Searches for strings in files.'],
      ['FORMAT','Formats a disk for use with Windows.'],
      ['GETMAC','Returns the MAC address and list of network protocols.'],
      ['HELP','Provides Help information for Windows commands.'],
      ['HOSTNAME','Prints the name of the current host.'],
      ['ICACLS','Display, modify, backup, or restore ACLs.'],
      ['IPCONFIG','Displays all current TCP/IP network configuration values.'],
      ['MD','Creates a directory.'],
      ['MKDIR','Creates a directory.'],
      ['MKLINK','Creates Symbolic Links and Hard Links.'],
      ['MODE','Configures a system device.'],
      ['MORE','Displays output one screen at a time.'],
      ['MOVE','Moves one or more files from one directory to another.'],
      ['NET','Provides various network services.'],
      ['NETSTAT','Displays protocol statistics and current TCP/IP connections.'],
      ['NSLOOKUP','Displays info that you can use to diagnose DNS infrastructure.'],
      ['PATH','Displays or sets a search path for executable files.'],
      ['PING','Tests a network connection to another computer.'],
      ['RD','Removes a directory.'],
      ['REN','Renames a file or files.'],
      ['RMDIR','Removes a directory.'],
      ['ROUTE','Manipulates network routing tables.'],
      ['SC','Displays or configures services.'],
      ['SET','Displays, sets, or removes Windows environment variables.'],
      ['SETX','Sets environment variables permanently.'],
      ['SFC','Scans integrity of all protected system files.'],
      ['SHUTDOWN','Allows proper local or remote shutdown of machine.'],
      ['SORT','Sorts input.'],
      ['START','Starts a separate window to run a specified program.'],
      ['SYSTEMINFO','Displays machine specific properties and configuration.'],
      ['TASKKILL','Kill or stop a running process or application.'],
      ['TASKLIST','Displays all currently running tasks including services.'],
      ['TIME','Displays or sets the system time.'],
      ['TITLE','Sets the window title for a CMD.EXE session.'],
      ['TRACERT','Traces the route taken by packets to reach destination.'],
      ['TREE','Graphically displays the folder structure of a drive or path.'],
      ['TYPE','Displays the contents of a text file.'],
      ['VER','Displays the Windows version.'],
      ['VOL','Displays a disk volume label and serial number.'],
      ['WHOAMI','Displays current user/groups and their respective SIDs.'],
      ['WMIC','Displays WMI information inside interactive command shell.'],
      ['XCOPY','Copies files and directory trees.'],
    ];
    this.addLine('For more information on a specific command, type HELP command-name');
    this.addLine('');
    commands.forEach(([name, desc]) => this.addLine(`${name.padEnd(16)}${desc}`));
  }

  private cmdEcho(args: string[], rawArgs: string): void {
    if (args.length === 0) { this.addLine('ECHO is on.'); return; }
    const appendIdx = rawArgs.indexOf('>>');
    const redirectIdx = rawArgs.indexOf('>');
    if (appendIdx > -1) {
      const text = rawArgs.substring(0, appendIdx).trim();
      const fileName = rawArgs.substring(appendIdx + 2).trim();
      const existing = this.fs.readFile(this.currentPath(), fileName) || '';
      this.fs.writeFile(this.currentPath(), fileName, existing + text + '\n');
    } else if (redirectIdx > -1) {
      const text = rawArgs.substring(0, redirectIdx).trim();
      const fileName = rawArgs.substring(redirectIdx + 1).trim();
      this.fs.writeFile(this.currentPath(), fileName, text + '\n');
    } else {
      if (rawArgs.toLowerCase() === 'on') { this.addLine('ECHO is on.'); return; }
      if (rawArgs.toLowerCase() === 'off') { this.addLine('ECHO is off.'); return; }
      this.addLine(rawArgs);
    }
  }

  private cmdDir(args: string[]): void {
    const path = this.currentPath();
    const entries = this.fs.getEntries(path);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    this.addLine(` Volume in drive C has no label.`);
    this.addLine(` Volume Serial Number is A3F2-B891`);
    this.addLine('');
    this.addLine(` Directory of ${path}`);
    this.addLine('');
    this.addLine(`${dateStr}  ${timeStr}    <DIR>          .`);
    this.addLine(`${dateStr}  ${timeStr}    <DIR>          ..`);

    let fileCount = 0, dirCount = 0, totalSize = 0;

    entries.forEach(entry => {
      if (entry.type === 'dir') {
        this.addLine(`${dateStr}  ${timeStr}    <DIR>          ${entry.name}`);
        dirCount++;
      } else {
        const size = (entry as any).size || 0;
        totalSize += size;
        this.addLine(`${dateStr}  ${timeStr}    ${size.toString().padStart(14)} ${entry.name}`);
        fileCount++;
      }
    });

    this.addLine(`             ${fileCount} File(s)    ${totalSize.toLocaleString()} bytes`);
    this.addLine(`             ${dirCount} Dir(s)  42,949,672,960 bytes free`);
  }

  private cmdCd(args: string[]): void {
    if (args.length === 0 || args[0] === '.') { this.addLine(this.currentPath()); return; }
    const arg = args[0].replace(/"/g, '');
    if (arg === '..') {
      const parts = this.currentPath().split('\\');
      if (parts.length > 1) {
        parts.pop();
        this.currentPath.set(parts.length === 1 ? parts[0] + '\\' : parts.join('\\'));
      }
      return;
    }
    if (arg === '\\') { this.currentPath.set('C:\\'); return; }
    const newPath = arg.includes(':') ? arg : `${this.currentPath()}\\${arg}`;
    if (this.fs.pathExists(newPath)) {
      this.currentPath.set(newPath);
    } else {
      this.addLine(`The system cannot find the path specified.`, 'error');
    }
  }

  private cmdMkdir(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    if (!this.fs.createDir(this.currentPath(), name)) {
      this.addLine(`A subdirectory or file ${name} already exists.`, 'error');
    }
  }

  private cmdRmdir(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    if (!this.fs.deleteEntry(this.currentPath(), name)) {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdDel(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    if (!this.fs.deleteEntry(this.currentPath(), name)) {
      this.addLine(`Could Not Find ${this.currentPath()}\\${name}`, 'error');
    }
  }

  private cmdType(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    const content = this.fs.readFile(this.currentPath(), name);
    if (content !== null) {
      content.split('\n').forEach(line => this.addLine(line));
    } else {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdCopy(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    if (this.fs.copyFile(this.currentPath(), args[0], this.currentPath(), args[1])) {
      this.addLine(`        1 file(s) copied.`, 'success');
    } else {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdMove(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    if (this.fs.copyFile(this.currentPath(), args[0], this.currentPath(), args[1])) {
      this.fs.deleteEntry(this.currentPath(), args[0]);
      this.addLine(`        1 file(s) moved.`, 'success');
    } else {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdRen(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    if (!this.fs.renameEntry(this.currentPath(), args[0], args[1])) {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdSet(args: string[]): void {
    if (args.length === 0) {
      Object.entries(this.envVars).sort().forEach(([k, v]) => this.addLine(`${k}=${v}`));
    } else {
      const full = args.join(' ');
      const eqIdx = full.indexOf('=');
      if (eqIdx > -1) {
        const key = full.substring(0, eqIdx).trim();
        const val = full.substring(eqIdx + 1).trim();
        this.envVars[key] = val;
      } else {
        const matches = Object.entries(this.envVars).filter(([k]) => k.toLowerCase().startsWith(args[0].toLowerCase()));
        if (matches.length) matches.forEach(([k, v]) => this.addLine(`${k}=${v}`));
        else this.addLine(`Environment variable ${args[0]} not defined`, 'error');
      }
    }
  }

  private cmdSetx(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    this.envVars[args[0]] = args[1];
    this.addLine('SUCCESS: Specified value was saved.', 'success');
  }

  private cmdDate(args: string[]): void {
    this.addLine(`The current date is: ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit', year: 'numeric' })}`);
  }

  private cmdTime(args: string[]): void {
    this.addLine(`The current time is: ${new Date().toLocaleTimeString('en-US', { hour12: false })}`);
  }

  private cmdIpconfig(args: string[]): void {
    const showAll = args.includes('/all') || args.includes('/ALL');
    this.addLine('Windows IP Configuration');
    if (showAll) {
      this.addLine('');
      this.addLine(`   Host Name . . . . . . . . . . . : ${this.envVars['COMPUTERNAME']}`);
      this.addLine(`   Primary Dns Suffix  . . . . . . :`);
      this.addLine(`   Node Type . . . . . . . . . . . : Hybrid`);
      this.addLine(`   IP Routing Enabled. . . . . . . : No`);
      this.addLine(`   WINS Proxy Enabled. . . . . . . : No`);
    }
    this.networkAdapters.forEach(adapter => {
      this.addLine('');
      this.addLine(adapter.name + ':');
      this.addLine('');
      if (showAll) {
        this.addLine(`   Connection-specific DNS Suffix  . : ${adapter.dns}`);
        this.addLine(`   Physical Address. . . . . . . . . : ${adapter.mac}`);
        this.addLine(`   DHCP Enabled. . . . . . . . . . . : Yes`);
        this.addLine(`   IPv6 Address. . . . . . . . . . . : ${adapter.ipv6}`, 'success');
        this.addLine(`   IPv4 Address. . . . . . . . . . . : ${adapter.ipv4}`, 'success');
        this.addLine(`   Subnet Mask . . . . . . . . . . . : ${adapter.subnet}`);
        this.addLine(`   Default Gateway . . . . . . . . . : ${adapter.gateway}`);
        this.addLine(`   DHCP Server . . . . . . . . . . . : ${adapter.dhcp}`);
        this.addLine(`   DNS Servers . . . . . . . . . . . : ${adapter.dns1}`);
        this.addLine(`                                       ${adapter.dns2}`);
      } else {
        this.addLine(`   Connection-specific DNS Suffix  . : ${adapter.dns}`);
        this.addLine(`   IPv6 Address. . . . . . . . . . . : ${adapter.ipv6}`, 'success');
        this.addLine(`   IPv4 Address. . . . . . . . . . . : ${adapter.ipv4}`, 'success');
        this.addLine(`   Subnet Mask . . . . . . . . . . . : ${adapter.subnet}`);
        this.addLine(`   Default Gateway . . . . . . . . . : ${adapter.gateway}`);
      }
    });
    if (args.includes('/flushdns') || args.includes('/FLUSHDNS')) {
      this.addLine('');
      this.addLine('Successfully flushed the DNS Resolver Cache.', 'success');
    }
  }

  private cmdPing(args: string[]): void {
    const host = args.find(a => !a.startsWith('/')) || 'localhost';
    const count = Math.min(parseInt(args.find(a => a.startsWith('/n'))?.slice(2) || '4') || 4, 10);
    this.addLine(`Pinging ${host} with 32 bytes of data:`);
    let received = 0;
    for (let i = 0; i < count; i++) {
      const time = Math.floor(Math.random() * 30 + 1);
      if (Math.random() < 0.05) {
        this.addLine(`Request timeout for icmp_seq ${i}`, 'error');
      } else {
        this.addLine(`Reply from ${host}: bytes=32 time=${time}ms TTL=128`, 'success');
        received++;
      }
    }
    const lost = count - received;
    this.addLine('');
    this.addLine(`Ping statistics for ${host}:`);
    this.addLine(`    Packets: Sent = ${count}, Received = ${received}, Lost = ${lost} (${Math.round(lost/count*100)}% loss),`);
    if (received > 0) this.addLine(`    Minimum = 1ms, Maximum = 30ms, Average = 15ms`);
  }

  private cmdTracert(args: string[]): void {
    const host = args[0] || 'google.com';
    this.addLine(`Tracing route to ${host} over a maximum of 30 hops:`);
    this.addLine('');
    const hops = Math.floor(Math.random() * 8 + 6);
    for (let i = 1; i <= hops; i++) {
      const t1 = Math.floor(Math.random() * 10 + 1);
      const t2 = Math.floor(Math.random() * 10 + 1);
      const t3 = Math.floor(Math.random() * 10 + 1);
      const ip = i === hops ? host : `10.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
      this.addLine(`  ${i.toString().padStart(2)}    ${t1}ms    ${t2}ms    ${t3}ms  ${ip}`);
    }
    this.addLine('');
    this.addLine('Trace complete.', 'success');
  }

  private cmdNslookup(args: string[]): void {
    const host = args[0] || 'google.com';
    this.addLine(`Server:  dns.google`);
    this.addLine(`Address:  8.8.8.8`);
    this.addLine('');
    this.addLine(`Non-authoritative answer:`);
    this.addLine(`Name:    ${host}`);
    this.addLine(`Addresses:  ${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`, 'success');
  }

  private cmdNetstat(args: string[]): void {
    this.addLine('Active Connections');
    this.addLine('');
    this.addLine('  Proto  Local Address          Foreign Address        State');
    const states = ['ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'LISTENING'];
    for (let i = 0; i < 8; i++) {
      const proto = Math.random() > 0.3 ? 'TCP' : 'UDP';
      const local = `192.168.1.100:${Math.floor(Math.random() * 40000 + 1024)}`;
      const foreign = `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}:${[80,443,8080][Math.floor(Math.random()*3)]}`;
      const state = states[Math.floor(Math.random() * states.length)];
      this.addLine(`  ${proto.padEnd(6)} ${local.padEnd(22)} ${foreign.padEnd(22)} ${state}`);
    }
  }

  private cmdNet(args: string[]): void {
    const sub = args[0]?.toLowerCase();
    switch (sub) {
      case 'user':
        this.addLine('User accounts for \\\\' + this.envVars['COMPUTERNAME']);
        this.addLine('-'.repeat(50));
        this.addLine('Administrator            Guest                    User');
        this.addLine('The command completed successfully.', 'success');
        break;
      case 'localgroup':
        this.addLine('Local Group Memberships');
        this.addLine('*Administrators          *Users');
        this.addLine('The command completed successfully.', 'success');
        break;
      case 'start':
        this.addLine(`Starting service ${args[1] || ''}...`, 'success');
        this.addLine('The service started successfully.', 'success');
        break;
      case 'stop':
        this.addLine(`Stopping service ${args[1] || ''}...`, 'success');
        this.addLine('The service stopped successfully.', 'success');
        break;
      default:
        this.addLine('NET [ ACCOUNTS | COMPUTER | CONFIG | CONTINUE | FILE | GROUP |');
        this.addLine('      LOCALGROUP | PAUSE | PRINT | SESSION | SHARE | START |');
        this.addLine('      STATISTICS | STOP | TIME | USE | USER | VIEW ]');
    }
  }

  private cmdArp(args: string[]): void {
    this.addLine('Interface: 192.168.1.100 --- 0xb');
    this.addLine('  Internet Address      Physical Address      Type');
    this.addLine('  192.168.1.1           4a-2b-3c-8d-1e-5f     dynamic');
    this.addLine('  192.168.1.255         ff-ff-ff-ff-ff-ff     static');
  }

  private cmdRoute(args: string[]): void {
    this.addLine('===========================================================================');
    this.addLine('IPv4 Route Table');
    this.addLine('===========================================================================');
    this.addLine('Active Routes:');
    this.addLine('Network Destination        Netmask          Gateway       Interface  Metric');
    this.addLine('          0.0.0.0          0.0.0.0      192.168.1.1    192.168.1.100     25');
    this.addLine('        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331');
    this.addLine('      192.168.1.0    255.255.255.0         On-link     192.168.1.100    281');
    this.addLine('===========================================================================');
  }

  private cmdSysteminfo(): void {
    const now = new Date();
    this.addLines([
      { text: `Host Name:                 ${this.envVars['COMPUTERNAME']}`, type: 'output' },
      { text: `OS Name:                   Microsoft Windows 7 Professional`, type: 'output' },
      { text: `OS Version:                6.1.7601 Service Pack 1 Build 7601`, type: 'output' },
      { text: `OS Manufacturer:           Microsoft Corporation`, type: 'output' },
      { text: `Registered Owner:          ${this.envVars['USERNAME']}`, type: 'output' },
      { text: `System Type:               x64-based PC`, type: 'output' },
      { text: `Processor(s):              Intel64 Family 6 Model 60 Stepping 3 GenuineIntel ~3400 Mhz`, type: 'output' },
      { text: `Total Physical Memory:     8,192 MB`, type: 'output' },
      { text: `Available Physical Memory: 4,096 MB`, type: 'output' },
      { text: `Windows Directory:         C:\\Windows`, type: 'output' },
      { text: `System Directory:          C:\\Windows\\System32`, type: 'output' },
      { text: `Domain:                    WORKGROUP`, type: 'output' },
      { text: `Logon Server:              \\\\${this.envVars['COMPUTERNAME']}`, type: 'output' },
    ]);
  }

  private cmdTasklist(args: string[]): void {
    this.addLine('');
    this.addLine('Image Name                     PID Session Name        Session#    Mem Usage');
    this.addLine('========================= ======== ================ =========== ============');
    const tasks = [
      ['System Idle Process','0','Services','0','24 K'],
      ['System','4','Services','0','1,432 K'],
      ['explorer.exe','1428','Console','1','42,768 K'],
      ['dwm.exe','1512','Console','1','35,816 K'],
      ['notepad.exe','2048','Console','1','8,192 K'],
      ['calc.exe','2312','Console','1','10,240 K'],
      ['cmd.exe','2860','Console','1','4,096 K'],
    ];
    tasks.forEach(([name, pid, session, num, mem]) => {
      this.addLine(`${name.padEnd(25)} ${pid.padStart(8)} ${session.padEnd(16)} ${num.padStart(11)} ${mem.padStart(12)}`);
    });
  }

  private cmdTaskkill(args: string[]): void {
    const pidIdx = args.findIndex(a => a.toLowerCase() === '/pid');
    const nameIdx = args.findIndex(a => a.toLowerCase() === '/im');
    if (pidIdx > -1 && args[pidIdx + 1]) {
      this.addLine(`SUCCESS: The process with PID ${args[pidIdx + 1]} has been terminated.`, 'success');
    } else if (nameIdx > -1 && args[nameIdx + 1]) {
      this.addLine(`SUCCESS: The process "${args[nameIdx + 1]}" with PID 1234 has been terminated.`, 'success');
    } else {
      this.addLine('ERROR: Invalid arguments.', 'error');
      this.addLine('Usage: TASKKILL [/F] [/PID processid | /IM imagename]');
    }
  }

  private cmdSc(args: string[]): void {
    const action = args[0]?.toLowerCase();
    const service = args[1] || 'service';
    if (action === 'query') {
      this.addLine(`SERVICE_NAME: ${service}`);
      this.addLine(`        STATE              : 4  RUNNING`, 'success');
    } else {
      this.addLine('DESCRIPTION: SC is a command line program used for communicating with the Service Control Manager.');
    }
  }

  private cmdReg(args: string[]): void {
    const action = args[0]?.toLowerCase();
    if (action === 'query') {
      this.addLine(`HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion`);
      this.addLine('    ProductName    REG_SZ    Windows 7 Professional');
      this.addLine('    CurrentVersion    REG_SZ    6.1');
      this.addLine('    CurrentBuild    REG_SZ    7601');
    } else {
      this.addLine('The operation completed successfully.', 'success');
    }
  }

  private cmdSfc(args: string[]): void {
    if (args.includes('/scannow') || args.includes('/SCANNOW')) {
      this.addLine('Beginning system scan. This process will take some time.');
      this.addLine('Verification 100% complete.');
      this.addLine('Windows Resource Protection did not find any integrity violations.', 'success');
    } else {
      this.addLine('Usage: SFC [/SCANNOW] [/VERIFYONLY] [/SCANFILE=<file>]');
    }
  }

  private cmdChkdsk(args: string[]): void {
    this.addLine('The type of the file system is NTFS.');
    this.addLine('Stage 1: Examining basic file system structure ... 262144 file records processed.');
    this.addLine('Stage 2: Examining file name linkage ... 271360 index entries processed.');
    this.addLine('Stage 3: Examining security descriptors ... completed.');
    this.addLine('  42,949,672,960 bytes total disk space.', 'success');
    this.addLine('  38,272,565,248 bytes available on disk.', 'success');
  }

  private cmdFormat(args: string[]): void {
    this.addLine('WARNING: This will erase all data on the disk.', 'error');
    this.addLine('FORMAT is not supported in this environment.', 'error');
  }

  private cmdColor(args: string[]): void {
    const colors: Record<string, string> = {
      '0': '#000000', '1': '#000080', '2': '#008000', '3': '#008080',
      '4': '#800000', '5': '#800080', '6': '#808000', '7': '#c0c0c0',
      '8': '#808080', '9': '#0000ff', 'a': '#00ff00', 'b': '#00ffff',
      'c': '#ff0000', 'd': '#ff00ff', 'e': '#ffff00', 'f': '#ffffff',
    };
    if (!args[0] || args[0].length !== 2) {
      this.addLine('COLOR [attr] — two hex digits: background foreground');
      this.addLine('0=Black 1=Blue 2=Green 3=Aqua 4=Red 5=Purple 6=Yellow 7=White');
      this.addLine('8=Gray  9=Lt Blue A=Lt Green B=Lt Aqua C=Lt Red D=Lt Purple E=Lt Yellow F=Bright White');
      return;
    }
    const bg = colors[args[0][0].toLowerCase()];
    const fg = colors[args[0][1].toLowerCase()];
    if (bg) this.bgColor.set(bg);
    if (fg) this.textColor.set(fg);
  }

  private cmdTitle(args: string[]): void {
    this.windowTitle = args.join(' ');
    this.addLine(`Title changed to: "${this.windowTitle}"`, 'success');
  }

  private cmdMode(args: string[]): void {
    this.addLine('Status for device CON:');
    this.addLine('    Lines: 300   Columns: 120   Code page: 437');
  }

  private cmdPrompt(args: string[]): void {
    this.addLine('Prompt format set.');
  }

  private cmdWhoami(args: string[]): void {
    if (args.includes('/all') || args.includes('/ALL')) {
      this.addLine(`USER INFORMATION`);
      this.addLine(`${this.envVars['COMPUTERNAME'].toLowerCase()}\\${this.envVars['USERNAME'].toLowerCase()}  S-1-5-21-1234567890-1234567890-1234567890-1001`);
      this.addLine('');
      this.addLine('GROUP INFORMATION');
      this.addLine('Everyone                             S-1-1-0');
      this.addLine('BUILTIN\\Administrators               S-1-5-32-544');
    } else {
      this.addLine(`${this.envVars['COMPUTERNAME'].toLowerCase()}\\${this.envVars['USERNAME'].toLowerCase()}`);
    }
  }

  private cmdTree(args: string[]): void {
    const startPath = args[0] ? `${this.currentPath()}\\${args[0]}` : this.currentPath();
    this.addLine(`Folder PATH listing`);
    this.addLine(startPath);
    const printTree = (path: string, prefix: string = '') => {
      const entries = this.fs.getEntries(path).filter(e => e.type === 'dir');
      entries.forEach((entry, idx) => {
        const isLast = idx === entries.length - 1;
        this.addLine(`${prefix}${isLast ? '└───' : '├───'}${entry.name}`);
        printTree(`${path}\\${entry.name}`, prefix + (isLast ? '    ' : '│   '));
      });
    };
    printTree(startPath);
  }

  private cmdAttrib(args: string[]): void {
    if (args.length === 0) {
      this.fs.getEntries(this.currentPath()).forEach(e => {
        this.addLine(`A                    ${this.currentPath()}\\${e.name}`);
      });
    } else {
      this.addLine('Attribute set successfully.', 'success');
    }
  }

  private cmdFind(args: string[]): void {
    const searchStr = args.find(a => a.startsWith('"'))?.replace(/"/g, '') || args[0];
    const file = args.find(a => !a.startsWith('/') && !a.startsWith('"') && a !== searchStr);
    if (!searchStr) { this.addLine('FIND: Parameter format not correct', 'error'); return; }
    if (file) {
      const content = this.fs.readFile(this.currentPath(), file) || '';
      const lines = content.split('\n').filter(l => l.toLowerCase().includes(searchStr.toLowerCase()));
      this.addLine(`---------- ${file}`);
      lines.forEach(l => this.addLine(l));
    } else {
      this.addLine('FIND: File not found', 'error');
    }
  }

  private cmdFindstr(args: string[]): void {
    const pattern = args.find(a => !a.startsWith('/'))?.replace(/"/g, '') || '';
    this.addLine(`FINDSTR: Pattern "${pattern}" search complete.`);
  }

  private cmdMore(args: string[]): void {
    if (!args[0]) { this.addLine('Displays output one screen at a time.'); return; }
    const content = this.fs.readFile(this.currentPath(), args[0]);
    if (content) content.split('\n').forEach(l => this.addLine(l));
    else this.addLine(`The system cannot find the file specified.`, 'error');
  }

  private cmdFc(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    this.addLine(`Comparing files ${args[0]} and ${args[1]}`);
    this.addLine('FC: no differences encountered', 'success');
  }

  private cmdXcopy(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    this.addLine(`${args[0]}`);
    this.addLine('1 File(s) copied', 'success');
  }

  private cmdAssoc(args: string[]): void {
    if (args.length === 0) {
      ['.bat=batfile','.cmd=cmdfile','.exe=exefile','.txt=txtfile','.log=txtfile'].forEach(a => this.addLine(a));
    } else {
      this.addLine(`${args[0]}=textfile`);
    }
  }

  private cmdFtype(args: string[]): void {
    if (args.length === 0) {
      this.addLine('txtfile="%SystemRoot%\\system32\\NOTEPAD.EXE" %1');
      this.addLine('exefile="%1" %*');
    } else {
      this.addLine(`${args[0]}="%SystemRoot%\\system32\\NOTEPAD.EXE" %1`);
    }
  }

  private cmdStart(args: string[]): void {
    const target = args[0]?.replace(/"/g, '') || '';
    if (!target) { this.addLine('Opens a new command prompt window.'); return; }
    this.addLine(`Starting: ${target}`, 'success');
  }

  private cmdShutdown(args: string[]): void {
    if (args.includes('/r') || args.includes('/R')) {
      this.addLine('The system is restarting...', 'system');
    } else if (args.includes('/s') || args.includes('/S')) {
      this.addLine('The system is shutting down...', 'system');
    } else if (args.includes('/a') || args.includes('/A')) {
      this.addLine('The scheduled shutdown has been cancelled.', 'success');
    } else if (args.includes('/l') || args.includes('/L')) {
      this.addLine('Logging off...', 'system');
    } else {
      this.addLine('Usage: shutdown [/s] [/r] [/l] [/a]');
      this.addLine('    /s - Shutdown    /r - Restart    /l - Log off    /a - Abort');
    }
  }

  private cmdIf(args: string[]): void {
    this.addLine('IF statement evaluated.');
  }

  private cmdWmic(args: string[]): void {
    const alias = args[0]?.toLowerCase();
    switch (alias) {
      case 'cpu': this.addLine('Intel(R) Core(TM) i7-4770 CPU @ 3.40GHz  ~3400 Mhz'); break;
      case 'memorychip': this.addLine('Capacity: 4294967296  Speed: 1600  x2 slots'); break;
      case 'os': this.addLine('Microsoft Windows 7 Professional  FreePhysicalMemory: 4194304'); break;
      case 'diskdrive': this.addLine('WDC WD5000AAKX-001CA0  Size: 500107862016'); break;
      case 'nic': this.addLine('Intel Ethernet Connection  MAC: 4A:2B:3C:8D:1E:5F'); break;
      case 'process': this.cmdTasklist([]); break;
      default:
        this.addLine('wmic:root\\cli>');
        this.addLine('Available aliases: cpu, memorychip, os, diskdrive, nic, process');
    }
  }

  private cmdWinver(): void {
    this.addLines([
      { text: 'Microsoft Windows', type: 'system' },
      { text: 'Version 6.1 (Build 7601: Service Pack 1)', type: 'output' },
      { text: 'Copyright (C) 2009 Microsoft Corporation', type: 'output' },
    ]);
  }

  private cmdCipher(args: string[]): void {
    this.addLine(` Listing ${this.currentPath()}`);
    this.addLine(` New files added to this directory will not be encrypted.`);
    this.addLine(`U ${this.currentPath()}`);
  }

  private cmdDriverquery(): void {
    this.addLine('Module Name  Display Name                   Driver Type   Link Date');
    this.addLine('============ ============================== ============= ======================');
    [['ACPI','Microsoft ACPI Driver','Kernel','11/20/2010'],['disk','Disk Driver','Kernel','11/20/2010'],['Ndis','NDIS System Driver','Kernel','11/20/2010']].forEach(([mod,disp,type,date]) => {
      this.addLine(`${mod.padEnd(12)} ${disp.padEnd(30)} ${type.padEnd(13)} ${date}`);
    });
  }

  private cmdGetmac(): void {
    this.addLine('');
    this.addLine('Connection Name         Physical Address    Transport Name');
    this.addLine('======================= =================== ===========================');
    this.networkAdapters.forEach(a => {
      this.addLine(`${a.name.substring(0, 23).padEnd(23)} ${a.mac.padEnd(19)} \\Device\\Tcpip_{A1B2C3D4}`);
    });
  }

  private cmdIcacls(args: string[]): void {
    const target = args[0] || this.currentPath();
    this.addLine(`${target} NT AUTHORITY\\SYSTEM:(OI)(CI)(F)`);
    this.addLine(`         BUILTIN\\Administrators:(OI)(CI)(F)`);
    this.addLine(`         BUILTIN\\Users:(OI)(CI)(RX)`);
    this.addLine('Successfully processed 1 files; Failed processing 0 files', 'success');
  }

  private cmdMklink(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    this.addLine(`Symbolic link created for ${args[0]} <<===>> ${args[1]}`, 'success');
  }

  private cmdSubst(args: string[]): void {
    if (args.length === 0) this.addLine('No substitutions are in effect.');
    else this.addLine(`${args[0]}: => ${args[1] || this.currentPath()}`, 'success');
  }

  private cmdVol(args: string[]): void {
    this.addLine(` Volume in drive C has no label.`);
    this.addLine(` Volume Serial Number is A3F2-B891`);
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      const el = this.scrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  focusInput(): void {
    this.inputEl?.nativeElement?.focus();
  }
}
