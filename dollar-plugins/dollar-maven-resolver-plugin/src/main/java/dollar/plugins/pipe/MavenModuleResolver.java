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

package dollar.plugins.pipe;

import dollar.api.DollarException;
import dollar.api.Pipeable;
import dollar.api.script.ModuleResolver;
import dollar.deps.DependencyRetriever;
import org.jetbrains.annotations.NotNull;

public class MavenModuleResolver implements ModuleResolver {
    @NotNull
    @Override
    public ModuleResolver copy() {
        return this;
    }

    @NotNull
    @Override
    public String getScheme() {
        return "mvn";
    }

    @NotNull
    @Override
    public <T, P> Pipeable retrieveModule(@NotNull String uriWithoutScheme, @NotNull T scope, @NotNull P parser) {
        String[] strings = uriWithoutScheme.split(":", 2);
        try {
            return (Pipeable) DependencyRetriever.retrieve(strings[1]).loadClass(strings[0]).newInstance();
        } catch (@NotNull Exception e) {
            throw new DollarException(e);
        }
    }
}
