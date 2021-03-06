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

package dollar.api;

import dollar.api.guard.ChainGuard;
import dollar.api.guard.Guarded;
import dollar.api.guard.NotNullGuard;
import org.jetbrains.annotations.NotNull;

@Deprecated
public interface PipeAware {

    default
    @NotNull
    @Guarded(NotNullGuard.class)
    @Guarded(ChainGuard.class)
    @Deprecated
    Value $pipe(@NotNull Pipeable pipe) {
        return $pipe("anon", pipe);
    }

    @NotNull
    @Guarded(NotNullGuard.class)
    @Guarded(ChainGuard.class)
    @Deprecated
    Value $pipe(@NotNull String label, @NotNull Pipeable pipe);

    @NotNull
    @Guarded(NotNullGuard.class)
    @Deprecated
    @Guarded(ChainGuard.class)
    Value $pipe(@NotNull String label, @NotNull String js);

    @NotNull
    @Deprecated
    @Guarded(NotNullGuard.class)
    @Guarded(ChainGuard.class)
    Value $pipe(@NotNull Class<? extends Pipeable> clazz);


}
