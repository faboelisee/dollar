/*
 * Copyright (c) 2014-2015 Neil Ellis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package me.neilellis.dollar.relproxy.impl.jproxy.shell.inter;

import me.neilellis.dollar.relproxy.RelProxyException;

/**
 * @author jmarranz
 */
public class CommandOther extends Command {
    public CommandOther(JProxyShellProcessor parent, String name) {
        super(parent, name);
    }

    @Override
    public boolean run() {
        switch (name) {
            case "clear":
                commandClear();
                break;
            case "display":
                commandDisplay();
                break;
            case "exec":
                commandExec();
                break;
            case "exit":
                commandExit();
                break;
            case "help":
                commandHelp();
                break;
            case "quit":
                commandExit();
                break;
            default:
                throw new RelProxyException("Internal Error");
        }

        return true;
    }

    @Override
    public void runPostCommand() {
    }

    private void commandClear() {
        parent.clearCodeBuffer();
    }

    private void commandDisplay() {
        System.out.println(
                "001>"); // La primera línea es siempre vacía porque en ella es donde ponemos el "public class
        // /_jproxyShellInMemoryClass_ { " que el usuario ignora, así al dar error el número de línea será
        // correcto respecto al "display"

        int i = 2;
        for (String line : parent.getCodeBuffer()) {
            for (int j = 0; j < 3 - String.valueOf(i).length(); j++) { System.out.print("0"); }
            System.out.print(i + ">");
            System.out.print(line);
            System.out.println();
            i++;
        }
    }

    private void commandExec() {
        parent.executeCodeBuffer();
    }

    private void commandExit() {
        System.exit(0);
    }

    private void commandHelp() {
        System.out.println(
                "Everything you write in the prompt is added to a code buffer, code buffer is compiled on the fly and" +
                " executed by exec command, unless a command is detected");
        System.out.println("");
        System.out.println("Available commands:");
        System.out.println(" clear");
        System.out.println("         Clears the buffer");
        System.out.println(" display");
        System.out.println("         Shows the buffer content");
        System.out.println(" edit last | <number>");
        System.out.println("         Edits the last introduced line code or the specified line number");
        System.out.println(" exec");
        System.out.println("         Compile and execute the buffer content");
        System.out.println(" exit");
        System.out.println("         Exits shell");
        System.out.println(" help");
        System.out.println("         This command");
        System.out.println(" insert last | <number>");
        System.out.println(
                "         Insert the next line of code before the last introduced line or the specified line number");
        System.out.println(" load <path> | <url>");
        System.out.println("         Load a file or URL into the buffer");
        System.out.println(" quit");
        System.out.println("         Same as exit");
        System.out.println(" save <path>");
        System.out.println("         Save the current buffer to a file");
    }
}
