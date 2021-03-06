/*
 *    Copyright (c) 2014-2017 Neil Ellis
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

package dollar.api.scripting;

import dollar.api.DollarException;
import dollar.api.Scope;
import dollar.api.Value;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ServiceLoader;

/**
 */
public final class ScriptingSupport {


    @NotNull
    private static final Logger log = LoggerFactory.getLogger("ScriptingSupport");

    @NotNull
    public static Value compile(@NotNull String language,
                                @NotNull String script,
                                @NotNull Scope scope) {
        ScriptingLanguage scriptingLanguage = resolveScriptProvider(language);
        return scriptingLanguage.compile(script, scope);
    }

    @NotNull
    public static ScriptingLanguage resolveScriptProvider(@NotNull String scheme) {
        final ServiceLoader<ScriptingLanguage> loader = ServiceLoader.load(ScriptingLanguage.class);
        for (ScriptingLanguage handler : loader) {
            if (handler.provides(scheme)) {
                return handler;
            }
        }
        throw new DollarException("Could not find any provider for scripting language " + scheme);
    }
}
