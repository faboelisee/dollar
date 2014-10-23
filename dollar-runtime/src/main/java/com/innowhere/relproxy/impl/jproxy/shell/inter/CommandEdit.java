/*
 *
 *  * See: https://github.com/jmarranz
 *  *
 *  * Copyright (c) 2014 Jose M. Arranz (additional work by Neil Ellis)
 *  *
 *  * Licensed under the Apache License, Version 2.0 (the "License");
 *  * you may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  *
 *  *       http://www.apache.org/licenses/LICENSE-2.0
 *  *
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" BASIS,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 */

package com.innowhere.relproxy.impl.jproxy.shell.inter;

/**
 * @author jmarranz
 */
public class CommandEdit extends CommandCodeChangerBase {
    public static final String NAME = "edit";
    protected String codeLine;

    public CommandEdit(JProxyShellProcessor parent, int line, String codeLine) {
        super(parent, NAME, line);
        this.codeLine = codeLine;
    }

    public static CommandEdit createCommandEdit(JProxyShellProcessor parent, String cmd) {
        int line = getLineFromParam(parent, NAME, cmd);
        if (line < 0) {
            switch (line) {
                case ERROR_LAST_REQUIRED:
                    System.out.println("Command error: parameter \"last\" or a line number is required");
                    break;
                case ERROR_NO_LAST_LINE:
                    System.out.println("Command error: no new or edited line code has been introduced");
                    break;
                case ERROR_NOT_A_NUMBER:
                    System.out.println("Command error: line value is not a number");
                    break;
                case ERROR_VALUE_NOT_0_OR_NEGATIVE:
                    System.out.println("Command error: line value cannot be 0 or negative");
                    break;
                case ERROR_LINE_1_NOT_VALID:
                    System.out.println("Command error: line 1 is ever empty and cannot be edited");
                    break;
                case ERROR_OUT_OF_RANGE:
                    System.out.println("Command error: line number out of range");
                    break;
                default:
                    // Para que se calle el FindBugs
            }
            return null;
        }

        String codeLine = parent.getCodeBuffer().get(line);
        return new CommandEdit(parent, line, codeLine);
    }

    @Override
    public void runPostCommand() {
        parent.getKeyboard().type(codeLine);
        parent.setLineEditing(line);
    }
}
