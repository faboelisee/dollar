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

package com.innowhere.relproxy.impl.jproxy.core.clsmgr;

import com.innowhere.relproxy.RelProxyException;
import com.innowhere.relproxy.impl.jproxy.core.JProxyImpl;
import org.jetbrains.annotations.NotNull;

import javax.script.ScriptContext;
import javax.script.ScriptEngine;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.LinkedList;

/**
 * @author jmarranz
 */
public class ClassDescriptorSourceScript extends ClassDescriptorSourceUnit {
    protected String source;

    public ClassDescriptorSourceScript(JProxyEngine engine, @NotNull String className, SourceScript sourceFile,
                                       long timestamp) {
        super(engine, className, sourceFile, timestamp);

        generateSourceCode();
    }

    private void generateSourceCode() {
        boolean[] hasHashBang = new boolean[1];

        String scriptCode = getSourceScript().getScriptCode(getEncoding(), hasHashBang);

        boolean completeClass = isCompleteClass(scriptCode);

        StringBuilder finalCode = new StringBuilder();
        finalCode.append("import me.neilellis.dollar.*;\n");
//        finalCode.append("import me.neilellis.dollar.script.lang.*;\n");
        finalCode.append("import static me.neilellis.dollar.api.DollarStatic.*;\n");
        finalCode.append("import java.util.*;\n");
        finalCode.append("import java.text.*;\n");
        finalCode.append("import java.util.concurrent.*;\n");
        finalCode.append("import java.util.regex.*;\n");
        finalCode.append("import java.util.jar.*;\n");
        finalCode.append("import java.util.zip.*;\n");
        finalCode.append("import java.io.*;\n");
        finalCode.append("import java.math.*;\n");
        finalCode.append("import java.nio.*;\n");
        finalCode.append("import java.nio.channels.*;\n");
        finalCode.append("import java.nio.charset.*;\n");
        finalCode.append("import java.net.*;\n");
        finalCode.append("import java.security.*;\n");
        finalCode.append("import java.sql.*;\n");
        finalCode.append("import java.awt.*;\n");
        finalCode.append("import javax.script.*;\n");
        if (completeClass) {
            if (hasHashBang[0])
                finalCode.append("\n");   // Como hemos quitado la línea #! añadimos una nueva para que los números de línea en caso de error coincidan con el original
            finalCode.append(scriptCode);
        } else {
            JProxyImpl jproxy = engine.getJProxy();
            String mainParamsDec = null;
            String mainReturnType = null;

            Class mainParamClass = jproxy.getMainParamClass();
            if (mainParamClass.equals(String[].class)) {
                mainParamsDec = "String[] args";
                mainReturnType = "void";
            } else if (mainParamClass.equals(ScriptContext.class)) {
                mainParamsDec = ScriptEngine.class.getName() + " engine," + ScriptContext.class.getName() + " context";
                mainReturnType = "Object";

                if (scriptCode.equals("")) scriptCode = "return null;";
            }

            finalCode.append("public class " +
                             className +
                             " extends me.neilellis.dollar.api.Unit { public static " +
                             mainReturnType +
                             " main(" +
                             mainParamsDec +
                             ") {\n"); // Lo ponemos todo en una línea para que en caso de error la línea de error coincida con el script original pues hemos quitado la primera línea #!
            finalCode.append(scriptCode);
            finalCode.append("  }\n");
            finalCode.append("}\n");
        }
        this.source = finalCode.toString();
    }

    @NotNull public SourceScript getSourceScript() {
        return (SourceScript) sourceFile;
    }

    private boolean isCompleteClass(@NotNull String code) {
        // Buscamos si hay un " class ..." o un "import..." al comienzo para soportar la definición de una clase completa como script
        int pos = code.indexOf("class");
        if (pos == -1) return false;
        // Hay al menos un "class", ojo que puede ser parte de una variable o dentro de un comentario, pero si no existiera desde luego que no es clase completa

        pos = getFirstPosIgnoringCommentsAndSeparators(code);
        if (pos == -1) return false;

        // Lo primero que nos tenemos encontrar es un import o una declaración de class
        int pos2 = code.indexOf("import", pos);
        if (pos2 == pos)
            return true; // Si hay un import hay declaración de clase

        // Vemos si es un "public class..." o similar
        int posClass = code.indexOf("class", pos);
        String visibility = code.substring(pos, posClass);
        visibility = visibility.trim(); // No consideramos \n hay que ser retorcido poner un \n entre el public y el class por ejemplo
        if (visibility.isEmpty()) return true; // No hay visibilidad, que no compile no es cosa nuestra
        return ("private".equals(visibility) || "public".equals(visibility) || "protected".equals(visibility));
    }

    private int getFirstPosIgnoringCommentsAndSeparators(@NotNull String code) {
        int i = -1;
        for (i = 0; i < code.length(); i++) {
            char c = code.charAt(i);
            if (c == ' ' || c == '\n' || c == '\t') continue;
            else if (c == '/' && i + 1 < code.length()) {
                char c2 = code.charAt(i + 1);
                if (c2 == '/') {
                    i = getFirstPosIgnoringOneLineComment(code, i);
                    if (i == -1) return -1; // Comentario mal formado
                } else if (c2 == '*') {
                    i = getFirstPosIgnoringMultiLineComment(code, i);
                    if (i == -1) return -1; // Comentario mal formado
                }
            } else break;
        }
        return i;
    }

    private int getFirstPosIgnoringOneLineComment(@NotNull String code, int start) {
        return code.indexOf('\n', start);
    }

    private int getFirstPosIgnoringMultiLineComment(@NotNull String code, int start) {
        return code.indexOf("*/", start);
    }

    public void callMainMethod(@NotNull LinkedList<String> argsToScript) throws Throwable {
        try {
            Class scriptClass = getLastLoadedClass();
            Method method = scriptClass.getDeclaredMethod("main", String[].class);
            String[] argsToScriptArr = argsToScript.size() > 0 ? argsToScript.toArray(new String[argsToScript.size()]) : new String[0];
            method.invoke(null, new Object[]{argsToScriptArr});
        } catch (IllegalAccessException | IllegalArgumentException | SecurityException | NoSuchMethodException ex) {
            throw new RelProxyException(ex);
        } catch (InvocationTargetException ex) {
            throw ex.getCause();
        } // Los errores de ejecución se envuelven en un InvocationTargetException
    }

    public Object callMainMethod(ScriptEngine engine, ScriptContext context) throws Throwable {
        Class scriptClass = getLastLoadedClass();
        return callMainMethod(scriptClass, engine, context);
    }

    public static Object callMainMethod(@NotNull Class scriptClass, ScriptEngine engine, ScriptContext context) throws
                                                                                                       Throwable {
        try {
            Method method = scriptClass.getDeclaredMethod("main", ScriptEngine.class, ScriptContext.class);
            return method.invoke(null, engine, context);
        } catch (IllegalAccessException | IllegalArgumentException | SecurityException | NoSuchMethodException ex) {
            throw new RelProxyException(ex);
        } catch (InvocationTargetException ex) {
            throw ex.getCause();
        } // Los errores de ejecución se envuelven en un InvocationTargetException
    }

    public String getSourceCode() {
        return source;
    }

    @Override
    public void updateTimestamp(long timestamp) {
        long oldTimestamp = this.timestamp;
        if (oldTimestamp != timestamp) { generateSourceCode(); }
        super.updateTimestamp(timestamp);
    }
}
