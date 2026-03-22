import {
  Component, signal, ViewChild, ElementRef,
  AfterViewChecked, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  lines = signal<CmdLine[]>([]);
  currentInput = signal('');
  currentPath = signal('C:\\Users\\User');
  history: string[] = [];
  historyIndex = -1;
  bgColor = signal('#1a1a1a');
  textColor = signal('#ffffff');
  private windowTitle = 'Command Prompt';

  private fileSystem: Record<string, Record<string, { type: 'dir' | 'file'; content?: string; size?: number; created?: Date }>> = {
    'C:\\': {
      'Users': { type: 'dir' },
      'Windows': { type: 'dir' },
      'Program Files': { type: 'dir' },
      'Program Files (x86)': { type: 'dir' },
    },
    'C:\\Users': { 'User': { type: 'dir' } },
    'C:\\Users\\User': {
      'Documents': { type: 'dir' },
      'Desktop': { type: 'dir' },
      'Downloads': { type: 'dir' },
      'Pictures': { type: 'dir' },
      'Music': { type: 'dir' },
      'Videos': { type: 'dir' },
    },
    'C:\\Users\\User\\Documents': {},
    'C:\\Users\\User\\Desktop': {},
    'C:\\Users\\User\\Downloads': {},
    'C:\\Users\\User\\Pictures': {},
    'C:\\Users\\User\\Music': {},
    'C:\\Users\\User\\Videos': {},
    'C:\\Windows': {
      'System32': { type: 'dir' },
      'SysWOW64': { type: 'dir' },
      'Temp': { type: 'dir' },
    },
    'C:\\Windows\\System32': {
      'cmd.exe': { type: 'file', size: 302592 },
      'notepad.exe': { type: 'file', size: 193536 },
      'calc.exe': { type: 'file', size: 776192 },
      'mspaint.exe': { type: 'file', size: 6291456 },
      'taskmgr.exe': { type: 'file', size: 234496 },
      'regedit.exe': { type: 'file', size: 437760 },
      'explorer.exe': { type: 'file', size: 2871808 },
    },
    'C:\\Windows\\Temp': {},
    'C:\\Program Files': {
      'Internet Explorer': { type: 'dir' },
      'Windows Media Player': { type: 'dir' },
    },
    'C:\\Program Files (x86)': {},
  };

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

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  constructor() {
    this.printWelcome();
    this.loadFileSystemFromStorage();
  }

  private loadFileSystemFromStorage(): void {
    const saved = localStorage.getItem('cmd_filesystem');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.assign(this.fileSystem, parsed);
      } catch {}
    }
  }

  private saveFileSystem(): void {
    localStorage.setItem('cmd_filesystem', JSON.stringify(this.fileSystem));
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
    const currentDir = this.fileSystem[this.currentPath()] || {};
    const match = Object.keys(currentDir).find(f => f.toLowerCase().startsWith(partial));
    if (match) {
      parts[parts.length - 1] = match.includes(' ') ? `"${match}"` : match;
      this.currentInput.set(parts.join(' '));
    }
  }

  private resolvePath(arg: string): string {
    if (!arg) return this.currentPath();
    if (arg.includes(':')) return arg.replace(/\//g, '\\');
    if (arg.startsWith('\\')) return `C:${arg}`;
    return `${this.currentPath()}\\${arg}`.replace(/\\/g, '\\');
  }

  private executeCommand(raw: string): void {
    // Handle piping and redirection at top level
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
      case 'devmgmt.msc': this.addLine('Device Manager requires elevated privileges.', 'error'); break;
      case 'compmgmt.msc': this.addLine('Computer Management requires elevated privileges.', 'error'); break;
      case 'diskmgmt.msc': this.addLine('Disk Management requires elevated privileges.', 'error'); break;
      case 'eventvwr': this.addLine('Event Viewer requires elevated privileges.', 'error'); break;
      case 'gpedit.msc': this.addLine('Group Policy Editor is not available in this edition.', 'error'); break;
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
      case 'ver': this.addLine('Microsoft Windows [Version 6.1.7601]'); break;
      case 'w32tm': this.addLine('Windows Time service is running.', 'success'); break;
      case 'net1': this.cmdNet(args); break;
      case '': break;
      default:
        // Check if it's an executable in system32
        if (cmd.endsWith('.exe') || cmd.endsWith('.bat') || cmd.endsWith('.cmd')) {
          this.addLine(`'${parts[0]}' is not recognized as an internal or external command,`, 'error');
          this.addLine('operable program or batch file.', 'error');
        } else {
          this.addLine(`'${parts[0]}' is not recognized as an internal or external command,`, 'error');
          this.addLine('operable program or batch file.', 'error');
        }
    }

    this.addLine('');
  }

  private cmdHelp(args: string[]): void {
    if (args[0]) {
      const helpTexts: Record<string, string[]> = {
        'cd': ['Displays the name of or changes the current directory.', '', 'CHDIR [/D] [drive:][path]', 'CHDIR [..]', 'CD [/D] [drive:][path]', 'CD [..]', '', '  ..   Specifies that you want to change to the parent directory.'],
        'dir': ['Displays a list of files and subdirectories in a directory.', '', 'DIR [drive:][path][filename] [/A[[:]attributes]] [/B] [/C] [/D] [/L] [/N]', '  [/O[[:]sortorder]] [/P] [/Q] [/R] [/S] [/T[[:]timefield]] [/W] [/X] [/4]'],
        'copy': ['Copies one or more files to another location.', '', 'COPY [/D] [/V] [/N] [/Y | /-Y] [/Z] [/L] [/A | /B ] source [/A | /B]', '     [+ source [/A | /B] [+ ...]] [destination [/A | /B]]'],
        'del': ['Deletes one or more files.', '', 'DEL [/P] [/F] [/S] [/Q] [/A[[:]attributes]] names', 'ERASE [/P] [/F] [/S] [/Q] [/A[[:]attributes]] names'],
        'ipconfig': ['Displays all current TCP/IP network configuration values.', '', 'IPCONFIG [/allcompartments] [/? | /all |', '                                 /renew [adapter] | /release [adapter] |', '                                 /renew6 [adapter] | /release6 [adapter] |', '                                 /flushdns | /displaydns | /registerdns |', '                                 /showclassid adapter |', '                                 /setclassid adapter [classid] |', '                                 /showclassid6 adapter |', '                                 /setclassid6 adapter [classid] ]'],
      };
      const help = helpTexts[args[0].toLowerCase()];
      if (help) {
        help.forEach(line => this.addLine(line));
      } else {
        this.addLine(`This command is not supported by the help utility.`, 'error');
      }
      return;
    }

    const commands = [
      ['ASSOC', 'Displays or modifies file extension associations.'],
      ['ATTRIB', 'Displays or changes file attributes.'],
      ['CALL', 'Calls one batch program from another.'],
      ['CD', 'Displays the name of or changes the current directory.'],
      ['CHDIR', 'Displays the name of or changes the current directory.'],
      ['CHKDSK', 'Checks a disk and displays a status report.'],
      ['CLS', 'Clears the screen.'],
      ['COLOR', 'Sets the default console foreground and background colors.'],
      ['COMP', 'Compares the contents of two files or sets of files.'],
      ['COMPACT', 'Displays or alters the compression of files on NTFS partitions.'],
      ['CONVERT', 'Converts FAT volumes to NTFS.'],
      ['COPY', 'Copies one or more files to another location.'],
      ['DATE', 'Displays or sets the date.'],
      ['DEL', 'Deletes one or more files.'],
      ['DIR', 'Displays a list of files and subdirectories in a directory.'],
      ['DISKPART', 'Displays or configures Disk Partition properties.'],
      ['DRIVERQUERY', 'Displays current device driver status and properties.'],
      ['ECHO', 'Displays messages, or turns command echoing on or off.'],
      ['ERASE', 'Deletes one or more files.'],
      ['EXIT', 'Quits the CMD.EXE program (command interpreter).'],
      ['FC', 'Compares two files or sets of files, and displays differences.'],
      ['FIND', 'Searches for a text string in a file or files.'],
      ['FINDSTR', 'Searches for strings in files.'],
      ['FOR', 'Runs a specified command for each file in a set of files.'],
      ['FORMAT', 'Formats a disk for use with Windows.'],
      ['FTYPE', 'Displays or modifies file types used in file extension associations.'],
      ['GETMAC', 'Returns the MAC address and list of network protocols.'],
      ['GOTO', 'Directs the Windows command interpreter to a labeled line.'],
      ['GPRESULT', 'Displays Group Policy information for machine or user.'],
      ['GPUPDATE', 'Updates Group Policy settings.'],
      ['HELP', 'Provides Help information for Windows commands.'],
      ['HOSTNAME', 'Prints the name of the current host.'],
      ['ICACLS', 'Display, modify, backup, or restore ACLs for files and directories.'],
      ['IF', 'Performs conditional processing in batch programs.'],
      ['IPCONFIG', 'Displays all current TCP/IP network configuration values.'],
      ['LABEL', 'Creates, changes, or deletes the volume label of a disk.'],
      ['MD', 'Creates a directory.'],
      ['MKDIR', 'Creates a directory.'],
      ['MKLINK', 'Creates Symbolic Links and Hard Links'],
      ['MODE', 'Configures a system device.'],
      ['MORE', 'Displays output one screen at a time.'],
      ['MOVE', 'Moves one or more files from one directory to another directory.'],
      ['NET', 'Provides various network services.'],
      ['NETSTAT', 'Displays protocol statistics and current TCP/IP connections.'],
      ['NSLOOKUP', 'Displays info that you can use to diagnose DNS infrastructure.'],
      ['PATH', 'Displays or sets a search path for executable files.'],
      ['PAUSE', 'Suspends processing of a batch file.'],
      ['PING', 'Tests a network connection to another computer.'],
      ['PROMPT', 'Changes the Windows command prompt.'],
      ['RD', 'Removes a directory.'],
      ['REN', 'Renames a file or files.'],
      ['RENAME', 'Renames a file or files.'],
      ['RMDIR', 'Removes a directory.'],
      ['ROBOCOPY', 'Advanced utility to copy files and directory trees.'],
      ['ROUTE', 'Manipulates network routing tables.'],
      ['RUNAS', 'Allows a user to run specific tools and programs.'],
      ['SC', 'Displays or configures services (background processes).'],
      ['SET', 'Displays, sets, or removes Windows environment variables.'],
      ['SETX', 'Sets environment variables permanently.'],
      ['SFC', 'Scans integrity of all protected system files.'],
      ['SHUTDOWN', 'Allows proper local or remote shutdown of machine.'],
      ['SORT', 'Sorts input.'],
      ['START', 'Starts a separate window to run a specified program or command.'],
      ['SUBST', 'Associates a path with a drive letter.'],
      ['SYSTEMINFO', 'Displays machine specific properties and configuration.'],
      ['TASKKILL', 'Kill or stop a running process or application.'],
      ['TASKLIST', 'Displays all currently running tasks including services.'],
      ['TIME', 'Displays or sets the system time.'],
      ['TITLE', 'Sets the window title for a CMD.EXE session.'],
      ['TRACERT', 'Traces the route taken by packets to reach destination.'],
      ['TREE', 'Graphically displays the folder structure of a drive or path.'],
      ['TYPE', 'Displays the contents of a text file.'],
      ['VER', 'Displays the Windows version.'],
      ['VOL', 'Displays a disk volume label and serial number.'],
      ['WHOAMI', 'Displays current user/groups and their respective SIDs.'],
      ['WMIC', 'Displays WMI information inside interactive command shell.'],
      ['XCOPY', 'Copies files and directory trees.'],
    ];

    this.addLine('For more information on a specific command, type HELP command-name');
    this.addLine('');
    commands.forEach(([name, desc]) => {
      this.addLine(`${name.padEnd(16)}${desc}`);
    });
  }

  private cmdEcho(args: string[], rawArgs: string): void {
    if (args.length === 0) { this.addLine('ECHO is on.'); return; }

    const appendIdx = rawArgs.indexOf('>>');
    const redirectIdx = rawArgs.indexOf('>');

    if (appendIdx > -1) {
      const text = rawArgs.substring(0, appendIdx).trim();
      const fileName = rawArgs.substring(appendIdx + 2).trim();
      const key = `notepad_${fileName}`;
      const existing = localStorage.getItem(key) || '';
      localStorage.setItem(key, existing + text + '\n');
      this.addFileToFS(fileName);
    } else if (redirectIdx > -1) {
      const text = rawArgs.substring(0, redirectIdx).trim();
      const fileName = rawArgs.substring(redirectIdx + 1).trim();
      localStorage.setItem(`notepad_${fileName}`, text + '\n');
      this.addFileToFS(fileName);
    } else {
      if (rawArgs.toLowerCase() === 'on') { this.addLine('ECHO is on.'); return; }
      if (rawArgs.toLowerCase() === 'off') { this.addLine('ECHO is off.'); return; }
      this.addLine(rawArgs);
    }
  }

  private addFileToFS(fileName: string): void {
    const dir = this.fileSystem[this.currentPath()];
    if (dir && !dir[fileName]) {
      dir[fileName] = { type: 'file', size: 0, created: new Date() };
      this.saveFileSystem();
    }
  }

  private cmdDir(args: string[]): void {
    const showAll = args.includes('/a') || args.includes('/A');
    const path = this.currentPath();
    const contents = this.fileSystem[path] || {};
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

    let fileCount = 0;
    let dirCount = 0;
    let totalSize = 0;

    Object.entries(contents).forEach(([name, info]) => {
      if (info.type === 'dir') {
        this.addLine(`${dateStr}  ${timeStr}    <DIR>          ${name}`);
        dirCount++;
      } else {
        const size = info.size || Math.floor(Math.random() * 9000 + 1000);
        totalSize += size;
        this.addLine(`${dateStr}  ${timeStr}    ${size.toString().padStart(14)} ${name}`);
        fileCount++;
      }
    });

    this.addLine(`             ${fileCount} File(s)    ${totalSize.toLocaleString()} bytes`);
    this.addLine(`             ${dirCount} Dir(s)  42,949,672,960 bytes free`);
  }

  private cmdCd(args: string[]): void {
    if (args.length === 0 || args[0] === '.') {
      this.addLine(this.currentPath()); return;
    }
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
    const normalized = newPath.replace(/\\\\/g, '\\');
    if (this.fileSystem[normalized] !== undefined) {
      this.currentPath.set(normalized);
    } else {
      this.addLine(`The system cannot find the path specified.`, 'error');
    }
  }

  private cmdMkdir(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    const newPath = `${this.currentPath()}\\${name}`;
    if (this.fileSystem[newPath]) {
      this.addLine(`A subdirectory or file ${name} already exists.`, 'error');
    } else {
      this.fileSystem[newPath] = {};
      const dir = this.fileSystem[this.currentPath()];
      if (dir) dir[name] = { type: 'dir' };
      this.saveFileSystem();
    }
  }

  private cmdRmdir(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    const targetPath = `${this.currentPath()}\\${name}`;
    const force = args.includes('/s') || args.includes('/S');
    if (!this.fileSystem[targetPath]) {
      this.addLine(`The system cannot find the file specified.`, 'error');
    } else {
      const isEmpty = Object.keys(this.fileSystem[targetPath]).length === 0;
      if (!isEmpty && !force) {
        this.addLine(`The directory is not empty.`, 'error');
      } else {
        delete this.fileSystem[targetPath];
        const dir = this.fileSystem[this.currentPath()];
        if (dir) delete dir[name];
        this.saveFileSystem();
      }
    }
  }

  private cmdDel(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    const dir = this.fileSystem[this.currentPath()];
    if (dir && dir[name]) {
      delete dir[name];
      localStorage.removeItem(`notepad_${name}`);
      this.saveFileSystem();
    } else {
      this.addLine(`Could Not Find ${this.currentPath()}\\${name}`, 'error');
    }
  }

  private cmdType(args: string[]): void {
    if (!args[0]) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const name = args[0].replace(/"/g, '');
    const content = localStorage.getItem(`notepad_${name}`);
    if (content !== null) {
      content.split('\n').forEach(line => this.addLine(line));
    } else {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdCopy(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const src = args[0].replace(/"/g, '');
    const dst = args[1].replace(/"/g, '');
    const content = localStorage.getItem(`notepad_${src}`);
    if (content !== null) {
      localStorage.setItem(`notepad_${dst}`, content);
      this.addFileToFS(dst);
      this.addLine(`        1 file(s) copied.`, 'success');
    } else {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdMove(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const src = args[0].replace(/"/g, '');
    const dst = args[1].replace(/"/g, '');
    const content = localStorage.getItem(`notepad_${src}`);
    if (content !== null) {
      localStorage.setItem(`notepad_${dst}`, content);
      localStorage.removeItem(`notepad_${src}`);
      const dir = this.fileSystem[this.currentPath()];
      if (dir) { delete dir[src]; this.addFileToFS(dst); }
      this.saveFileSystem();
      this.addLine(`        1 file(s) moved.`, 'success');
    } else {
      this.addLine(`The system cannot find the file specified.`, 'error');
    }
  }

  private cmdRen(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    const oldName = args[0].replace(/"/g, '');
    const newName = args[1].replace(/"/g, '');
    const dir = this.fileSystem[this.currentPath()];
    if (dir && dir[oldName]) {
      dir[newName] = dir[oldName];
      delete dir[oldName];
      const content = localStorage.getItem(`notepad_${oldName}`);
      if (content !== null) {
        localStorage.setItem(`notepad_${newName}`, content);
        localStorage.removeItem(`notepad_${oldName}`);
      }
      this.saveFileSystem();
    } else {
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
    const now = new Date();
    this.addLine(`The current date is: ${now.toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit', year: 'numeric' })}`);
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
        this.addLine(`   Description . . . . . . . . . . . : ${adapter.name}`);
        this.addLine(`   Physical Address. . . . . . . . . : ${adapter.mac}`);
        this.addLine(`   DHCP Enabled. . . . . . . . . . . : Yes`);
        this.addLine(`   Autoconfiguration Enabled . . . . : Yes`);
        this.addLine(`   IPv6 Address. . . . . . . . . . . : ${adapter.ipv6}`, 'success');
        this.addLine(`   IPv4 Address. . . . . . . . . . . : ${adapter.ipv4}`, 'success');
        this.addLine(`   Subnet Mask . . . . . . . . . . . : ${adapter.subnet}`);
        this.addLine(`   Lease Obtained. . . . . . . . . . : ${new Date().toLocaleDateString()}`);
        this.addLine(`   Lease Expires . . . . . . . . . . : ${new Date(Date.now() + 86400000).toLocaleDateString()}`);
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
    const count = parseInt(args.find(a => a.startsWith('-n') || a.startsWith('/n'))?.slice(2) || '4');
    const actualCount = Math.min(count || 4, 10);

    this.addLine(`Pinging ${host} with 32 bytes of data:`);
    let received = 0;
    for (let i = 0; i < actualCount; i++) {
      const time = Math.floor(Math.random() * 30 + 1);
      const fail = Math.random() < 0.05;
      if (fail) {
        this.addLine(`Request timeout for icmp_seq ${i}`, 'error');
      } else {
        this.addLine(`Reply from ${host}: bytes=32 time=${time}ms TTL=128`, 'success');
        received++;
      }
    }
    const lost = actualCount - received;
    const lostPct = Math.round((lost / actualCount) * 100);
    this.addLine('');
    this.addLine(`Ping statistics for ${host}:`);
    this.addLine(`    Packets: Sent = ${actualCount}, Received = ${received}, Lost = ${lost} (${lostPct}% loss),`);
    if (received > 0) {
      this.addLine(`Approximate round trip times in milli-seconds:`);
      this.addLine(`    Minimum = 1ms, Maximum = 30ms, Average = 15ms`);
    }
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
    const showAll = args.includes('-a') || args.includes('-A');
    this.addLine('Active Connections');
    this.addLine('');
    this.addLine('  Proto  Local Address          Foreign Address        State');
    const states = ['ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'LISTENING'];
    const ports = [[80, 443, 8080, 3000, 5000], [80, 443, 53, 22, 21]];
    for (let i = 0; i < 8; i++) {
      const proto = Math.random() > 0.3 ? 'TCP' : 'UDP';
      const local = `192.168.1.100:${Math.floor(Math.random() * 40000 + 1024)}`;
      const foreign = `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}:${ports[0][Math.floor(Math.random()*ports[0].length)]}`;
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
      case 'use':
        this.addLine('New connections will not be remembered.', 'output');
        this.addLine('There are no entries in the list.', 'output');
        break;
      case 'view':
        this.addLine(`\\\\${this.envVars['COMPUTERNAME']}`);
        this.addLine('The command completed successfully.', 'success');
        break;
      default:
        this.addLines([
          { text: 'The syntax of this command is:', type: 'output' },
          { text: 'NET [ ACCOUNTS | COMPUTER | CONFIG | CONTINUE | FILE | GROUP | HELP |', type: 'output' },
          { text: '      HELPMSG | LOCALGROUP | PAUSE | PRINT | SESSION | SHARE | START |', type: 'output' },
          { text: '      STATISTICS | STOP | TIME | USE | USER | VIEW ]', type: 'output' },
        ]);
    }
  }

  private cmdArp(args: string[]): void {
    this.addLine('Interface: 192.168.1.100 --- 0xb');
    this.addLine('  Internet Address      Physical Address      Type');
    this.addLine('  192.168.1.1           4a-2b-3c-8d-1e-5f     dynamic');
    this.addLine('  192.168.1.255         ff-ff-ff-ff-ff-ff     static');
    this.addLine('  224.0.0.22            01-00-5e-00-00-16     static');
  }

  private cmdRoute(args: string[]): void {
    const sub = args[0]?.toLowerCase();
    if (sub === 'print' || !sub) {
      this.addLine('===========================================================================');
      this.addLine('Interface List');
      this.addLine(' 11...4a 2b 3c 8d 1e 5f ......Intel Ethernet Connection');
      this.addLine(' 14...b8 27 eb 1a 2c 3d ......Wireless LAN adapter Wi-Fi');
      this.addLine('===========================================================================');
      this.addLine('');
      this.addLine('IPv4 Route Table');
      this.addLine('===========================================================================');
      this.addLine('Active Routes:');
      this.addLine('Network Destination        Netmask          Gateway       Interface  Metric');
      this.addLine('          0.0.0.0          0.0.0.0      192.168.1.1    192.168.1.100     25');
      this.addLine('        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331');
      this.addLine('      192.168.1.0    255.255.255.0         On-link     192.168.1.100    281');
      this.addLine('===========================================================================');
    }
  }

  private cmdSysteminfo(): void {
    const now = new Date();
    this.addLines([
      { text: `Host Name:                 ${this.envVars['COMPUTERNAME']}`, type: 'output' },
      { text: `OS Name:                   Microsoft Windows 7 Professional`, type: 'output' },
      { text: `OS Version:                6.1.7601 Service Pack 1 Build 7601`, type: 'output' },
      { text: `OS Manufacturer:           Microsoft Corporation`, type: 'output' },
      { text: `OS Configuration:          Standalone Workstation`, type: 'output' },
      { text: `OS Build Type:             Multiprocessor Free`, type: 'output' },
      { text: `Registered Owner:          ${this.envVars['USERNAME']}`, type: 'output' },
      { text: `Registered Organization:   N/A`, type: 'output' },
      { text: `Product ID:                00371-OEM-8992671-00524`, type: 'output' },
      { text: `Original Install Date:     ${now.toLocaleDateString()}`, type: 'output' },
      { text: `System Boot Time:          ${now.toLocaleDateString()}, ${now.toLocaleTimeString()}`, type: 'output' },
      { text: `System Manufacturer:       Dell Inc.`, type: 'output' },
      { text: `System Model:              OptiPlex 7010`, type: 'output' },
      { text: `System Type:               x64-based PC`, type: 'output' },
      { text: `Processor(s):              1 Processor(s) Installed.`, type: 'output' },
      { text: `                           [01]: Intel64 Family 6 Model 60 Stepping 3`, type: 'output' },
      { text: `                                 GenuineIntel ~3400 Mhz`, type: 'output' },
      { text: `BIOS Version:              Dell Inc. A09, 01/09/2014`, type: 'output' },
      { text: `Windows Directory:         C:\\Windows`, type: 'output' },
      { text: `System Directory:          C:\\Windows\\System32`, type: 'output' },
      { text: `Boot Device:               \\Device\\HarddiskVolume1`, type: 'output' },
      { text: `System Locale:             en-us;English (United States)`, type: 'output' },
      { text: `Input Locale:              en-us;English (United States)`, type: 'output' },
      { text: `Time Zone:                 (UTC-05:00) Eastern Time (US & Canada)`, type: 'output' },
      { text: `Total Physical Memory:     8,192 MB`, type: 'output' },
      { text: `Available Physical Memory: 4,096 MB`, type: 'output' },
      { text: `Virtual Memory: Max Size:  16,384 MB`, type: 'output' },
      { text: `Virtual Memory: Available: 12,288 MB`, type: 'output' },
      { text: `Virtual Memory: In Use:    4,096 MB`, type: 'output' },
      { text: `Page File Location(s):     C:\\pagefile.sys`, type: 'output' },
      { text: `Domain:                    WORKGROUP`, type: 'output' },
      { text: `Logon Server:              \\\\${this.envVars['COMPUTERNAME']}`, type: 'output' },
      { text: `Hotfix(s):                 3 Hotfix(s) Installed.`, type: 'output' },
      { text: `                           [01]: KB2670838`, type: 'output' },
      { text: `                           [02]: KB2830477`, type: 'output' },
      { text: `                           [03]: KB2592687`, type: 'output' },
      { text: `Network Card(s):           2 NIC(s) Installed.`, type: 'output' },
      { text: `                           [01]: Intel Ethernet Connection`, type: 'success' },
      { text: `                                 Connection Name: Local Area Connection`, type: 'output' },
      { text: `                                 DHCP Enabled:    Yes`, type: 'output' },
      { text: `                                 DHCP Server:     192.168.1.1`, type: 'output' },
      { text: `                                 IP address(es)`, type: 'output' },
      { text: `                                 [01]: 192.168.1.100`, type: 'success' },
    ]);
  }

  private cmdTasklist(args: string[]): void {
    this.addLine('');
    this.addLine('Image Name                     PID Session Name        Session#    Mem Usage');
    this.addLine('========================= ======== ================ =========== ============');
    const tasks = [
      ['System Idle Process', '0', 'Services', '0', '24 K'],
      ['System', '4', 'Services', '0', '1,432 K'],
      ['smss.exe', '344', 'Services', '0', '1,192 K'],
      ['csrss.exe', '436', 'Services', '0', '4,560 K'],
      ['wininit.exe', '508', 'Services', '0', '3,884 K'],
      ['csrss.exe', '516', 'Console', '1', '14,256 K'],
      ['winlogon.exe', '556', 'Console', '1', '5,964 K'],
      ['services.exe', '616', 'Services', '0', '7,400 K'],
      ['lsass.exe', '624', 'Services', '0', '9,128 K'],
      ['svchost.exe', '776', 'Services', '0', '7,016 K'],
      ['svchost.exe', '844', 'Services', '0', '5,544 K'],
      ['explorer.exe', '1428', 'Console', '1', '42,768 K'],
      ['dwm.exe', '1512', 'Console', '1', '35,816 K'],
      ['taskbar.exe', '1876', 'Console', '1', '12,344 K'],
      ['notepad.exe', '2048', 'Console', '1', '8,192 K'],
      ['calc.exe', '2312', 'Console', '1', '10,240 K'],
      ['cmd.exe', '2860', 'Console', '1', '4,096 K'],
      ['conhost.exe', '2868', 'Console', '1', '5,460 K'],
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
    switch (action) {
      case 'query':
        this.addLine(`SERVICE_NAME: ${service}`);
        this.addLine(`        TYPE               : 20  WIN32_SHARE_PROCESS`);
        this.addLine(`        STATE              : 4  RUNNING`, 'success');
        this.addLine(`        WIN32_EXIT_CODE    : 0  (0x0)`);
        this.addLine(`        SERVICE_EXIT_CODE  : 0  (0x0)`);
        this.addLine(`        CHECKPOINT         : 0x0`);
        this.addLine(`        WAIT_HINT          : 0x0`);
        break;
      case 'start':
        this.addLine(`[SC] StartService FAILED 1053:`, 'error');
        this.addLine(`The service did not respond to the start or control request in a timely fashion.`, 'error');
        break;
      case 'stop':
        this.addLine(`[SC] ControlService FAILED 1062:`, 'error');
        this.addLine(`The service has not been started.`, 'error');
        break;
      default:
        this.addLine('DESCRIPTION: SC is a command line program used for communicating with the');
        this.addLine('Service Control Manager and services.');
    }
  }

  private cmdReg(args: string[]): void {
    const action = args[0]?.toLowerCase();
    switch (action) {
      case 'query':
        this.addLine(`HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion`);
        this.addLine('    ProductName    REG_SZ    Windows 7 Professional');
        this.addLine('    CurrentVersion    REG_SZ    6.1');
        this.addLine('    CurrentBuild    REG_SZ    7601');
        this.addLine('    RegisteredOwner    REG_SZ    User');
        break;
      case 'add':
        this.addLine('The operation completed successfully.', 'success');
        break;
      case 'delete':
        this.addLine('The operation completed successfully.', 'success');
        break;
      default:
        this.addLine('REG Operation [Parameter List]');
        this.addLine('  Operation  [ QUERY | ADD | DELETE | COPY | SAVE | LOAD | UNLOAD | RESTORE | COMPARE | EXPORT | IMPORT | FLAGS ]');
    }
  }

  private cmdSfc(args: string[]): void {
    if (args.includes('/scannow') || args.includes('/SCANNOW')) {
      this.addLine('Beginning system scan.  This process will take some time.');
      this.addLine('');
      this.addLine('Beginning verification phase of system scan.');
      this.addLine('Verification 100% complete.');
      this.addLine('');
      this.addLine('Windows Resource Protection did not find any integrity violations.', 'success');
    } else {
      this.addLine('Microsoft (R) Windows (R) Resource Checker Version 6.0');
      this.addLine('Usage: SFC [/SCANNOW] [/VERIFYONLY] [/SCANFILE=<file>]');
    }
  }

  private cmdChkdsk(args: string[]): void {
    this.addLine('The type of the file system is NTFS.');
    this.addLine('');
    this.addLine('Stage 1: Examining basic file system structure ...');
    this.addLine('  262144 file records processed.');
    this.addLine('File verification completed.');
    this.addLine('');
    this.addLine('Stage 2: Examining file name linkage ...');
    this.addLine('  271360 index entries processed.');
    this.addLine('Index verification completed.');
    this.addLine('');
    this.addLine('Stage 3: Examining security descriptors ...');
    this.addLine('Security descriptor verification completed.');
    this.addLine('');
    this.addLine('  42,949,672,960 bytes total disk space.', 'success');
    this.addLine('   4,128,768,000 bytes in 98,304 files.');
    this.addLine('      14,680,064 bytes in 4,096 indexes.');
    this.addLine('               0 bytes in bad sectors.');
    this.addLine('     533,659,648 bytes in use by the system.');
    this.addLine('  38,272,565,248 bytes available on disk.', 'success');
    this.addLine('           4,096 bytes in each allocation unit.');
    this.addLine('      10,485,760 total allocation units on disk.');
    this.addLine('       9,344,384 allocation units available on disk.');
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
    if (!args[0]) {
      this.addLine('Sets the default console foreground and background colors.');
      this.addLine('COLOR [attr]');
      this.addLine('  attr = two hex digits: first is background, second is foreground');
      this.addLine('  0=Black  1=Blue   2=Green  3=Aqua   4=Red    5=Purple');
      this.addLine('  6=Yellow 7=White  8=Gray   9=Lt Blue A=Lt Green B=Lt Aqua');
      this.addLine('  C=Lt Red D=Lt Purple E=Lt Yellow F=Bright White');
      return;
    }
    if (args[0].length !== 2) { this.addLine('Invalid argument.', 'error'); return; }
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
    this.addLine('----------------------');
    this.addLine('    Lines:          300');
    this.addLine('    Columns:        120');
    this.addLine('    Keyboard rate:  31');
    this.addLine('    Keyboard delay: 1');
    this.addLine('    Code page:      437');
  }

  private cmdPrompt(args: string[]): void {
    this.addLine('Prompt format set. (Changes to prompt display are cosmetic only)');
  }

  private cmdWhoami(args: string[]): void {
    if (args.includes('/all') || args.includes('/ALL')) {
      this.addLine(`USER INFORMATION`);
      this.addLine(`----------------`);
      this.addLine(`User Name                     SID`);
      this.addLine(`============================= =============================================`);
      this.addLine(`${this.envVars['COMPUTERNAME'].toLowerCase()}\\${this.envVars['USERNAME'].toLowerCase()}  S-1-5-21-1234567890-1234567890-1234567890-1001`);
      this.addLine('');
      this.addLine('GROUP INFORMATION');
      this.addLine('-----------------');
      this.addLine('Group Name                           SID');
      this.addLine('==================================== ============');
      this.addLine('Everyone                             S-1-1-0');
      this.addLine('BUILTIN\\Users                        S-1-5-32-545');
      this.addLine('BUILTIN\\Administrators               S-1-5-32-544');
    } else if (args.includes('/user') || args.includes('/USER')) {
      this.addLine(`${this.envVars['COMPUTERNAME']}\\${this.envVars['USERNAME']}`);
    } else {
      this.addLine(`${this.envVars['COMPUTERNAME'].toLowerCase()}\\${this.envVars['USERNAME'].toLowerCase()}`);
    }
  }

  private cmdTree(args: string[]): void {
    const startPath = args[0] ? this.resolvePath(args[0]) : this.currentPath();
    this.addLine(`Folder PATH listing for volume OS`);
    this.addLine(`Volume serial number is A3F2-B891`);
    this.addLine(startPath);

    const printTree = (path: string, prefix: string = '') => {
      const contents = this.fileSystem[path] || {};
      const entries = Object.entries(contents).filter(([_, info]) => info.type === 'dir');
      entries.forEach(([name], idx) => {
        const isLast = idx === entries.length - 1;
        const connector = isLast ? '└───' : '├───';
        const childPrefix = isLast ? prefix + '    ' : prefix + '│   ';
        this.addLine(`${prefix}${connector}${name}`);
        printTree(`${path}\\${name}`, childPrefix);
      });
    };

    printTree(startPath);
  }

  private cmdAttrib(args: string[]): void {
    if (args.length === 0) {
      const dir = this.fileSystem[this.currentPath()] || {};
      Object.keys(dir).forEach(name => {
        this.addLine(`A                    ${this.currentPath()}\\${name}`);
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
      const content = localStorage.getItem(`notepad_${file}`) || '';
      const lines = content.split('\n').filter(l => l.toLowerCase().includes(searchStr.toLowerCase()));
      if (lines.length) {
        this.addLine(`---------- ${file}`);
        lines.forEach(l => this.addLine(l));
      } else {
        this.addLine(`---------- ${file}`);
      }
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
    const content = localStorage.getItem(`notepad_${args[0]}`);
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
      const assocs = ['.bat=batfile', '.cmd=cmdfile', '.com=comfile', '.exe=exefile', '.txt=txtfile', '.log=txtfile', '.ini=inifile', '.sys=sysfile'];
      assocs.forEach(a => this.addLine(a));
    } else {
      this.addLine(`${args[0]}=textfile`);
    }
  }

  private cmdFtype(args: string[]): void {
    if (args.length === 0) {
      this.addLine('txtfile="%SystemRoot%\\system32\\NOTEPAD.EXE" %1');
      this.addLine('batfile="%1" %*');
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
      this.addLine('Usage: shutdown [/i | /l | /s | /r | /a | /p | /h | /e]');
      this.addLine('    /s - Shutdown the computer.');
      this.addLine('    /r - Restart the computer.');
      this.addLine('    /l - Log off.');
      this.addLine('    /a - Abort a system shutdown.');
      this.addLine('    /t xxx - Set timeout before shutdown to xxx seconds.');
    }
  }

  private cmdIf(args: string[]): void {
    this.addLine('IF statement evaluated.');
  }

  private cmdWmic(args: string[]): void {
    const alias = args[0]?.toLowerCase();
    switch (alias) {
      case 'cpu':
        this.addLine('Caption                                 DeviceID  MaxClockSpeed  Name');
        this.addLine('Intel64 Family 6 Model 60 Stepping 3  CPU0      3400           Intel(R) Core(TM) i7-4770 CPU @ 3.40GHz');
        break;
      case 'memorychip':
        this.addLine('Capacity    DeviceLocator  MemoryType  Speed');
        this.addLine('4294967296  DIMM0          24          1600');
        this.addLine('4294967296  DIMM1          24          1600');
        break;
      case 'os':
        this.addLine('Caption                          FreePhysicalMemory  TotalVisibleMemorySize');
        this.addLine('Microsoft Windows 7 Professional  4194304             8388608');
        break;
      case 'diskdrive':
        this.addLine('Caption                    DeviceID            Model                      Size');
        this.addLine('WDC WD5000AAKX-001CA0      \\\\.\\PHYSICALDRIVE0  WDC WD5000AAKX-001CA0      500107862016');
        break;
      case 'nic':
        this.addLine('Description                    MACAddress         Speed');
        this.addLine('Intel Ethernet Connection      4A:2B:3C:8D:1E:5F  1000000000');
        break;
      case 'process':
        this.cmdTasklist([]);
        break;
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
    this.addLine(` Listing C:\\Users\\User\\`);
    this.addLine(` New files added to this directory will not be encrypted.`);
    this.addLine('');
    this.addLine(`U ${this.currentPath()}`);
  }

  private cmdDriverquery(): void {
    this.addLine('Module Name  Display Name           Driver Type   Link Date');
    this.addLine('============ ====================== ============= ======================');
    const drivers = [
      ['ACPI', 'Microsoft ACPI Driver', 'Kernel', '11/20/2010'],
      ['disk', 'Disk Driver', 'Kernel', '11/20/2010'],
      ['Ndis', 'NDIS System Driver', 'Kernel', '11/20/2010'],
      ['nvlddmkm', 'NVIDIA Windows Kernel Mode Driver', 'Kernel', '01/15/2014'],
      ['intelppm', 'Intel Processor Driver', 'Kernel', '11/20/2010'],
    ];
    drivers.forEach(([mod, disp, type, date]) => {
      this.addLine(`${mod.padEnd(12)} ${disp.padEnd(22)} ${type.padEnd(13)} ${date}`);
    });
  }

  private cmdGetmac(): void {
    this.addLine('');
    this.addLine('Connection Name         Network Adapter                    Physical Address    Transport Name');
    this.addLine('======================= ================================== =================== ==========================================================');
    this.networkAdapters.forEach(a => {
      this.addLine(`${a.name.substring(0, 23).padEnd(23)} ${a.name.padEnd(34)} ${a.mac.padEnd(19)} \\Device\\Tcpip_{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}`);
    });
  }

  private cmdIcacls(args: string[]): void {
    const target = args[0] || this.currentPath();
    this.addLine(`${target} NT AUTHORITY\\SYSTEM:(OI)(CI)(F)`);
    this.addLine(`         BUILTIN\\Administrators:(OI)(CI)(F)`);
    this.addLine(`         BUILTIN\\Users:(OI)(CI)(RX)`);
    this.addLine(`         CREATOR OWNER:(OI)(CI)(IO)(F)`);
    this.addLine('');
    this.addLine('Successfully processed 1 files; Failed processing 0 files', 'success');
  }

  private cmdMklink(args: string[]): void {
    if (args.length < 2) { this.addLine('The syntax of the command is incorrect.', 'error'); return; }
    this.addLine(`Symbolic link created for ${args[0]} <<===>> ${args[1]}`, 'success');
  }

  private cmdSubst(args: string[]): void {
    if (args.length === 0) {
      this.addLine('No substitutions are in effect.');
    } else {
      this.addLine(`${args[0]}: => ${args[1] || this.currentPath()}`, 'success');
    }
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
