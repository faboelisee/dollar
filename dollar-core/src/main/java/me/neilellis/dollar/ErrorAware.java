/*
 * Copyright (c) 2014 Neil Ellis
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

package me.neilellis.dollar;

import me.neilellis.dollar.collections.ImmutableList;
import me.neilellis.dollar.guard.ChainGuard;
import me.neilellis.dollar.guard.Guarded;
import me.neilellis.dollar.guard.NotNullCollectionGuard;
import me.neilellis.dollar.guard.NotNullParametersGuard;
import org.jetbrains.annotations.NotNull;

import java.util.List;
import java.util.function.Consumer;

/**
 * The interface Error aware.
 * @author  <a href="http://uk.linkedin.com/in/neilellis">Neil Ellis</a>
 */
public interface ErrorAware {
    /**
     * The enum Error type.
     */
    public enum ErrorType {
        /**
         * The VALIDATION.
         */
        VALIDATION, /**
         * The SYSTEM.
         */
        SYSTEM
    }

    /**
     * $ error.
     *
     * @param errorMessage the error message
     *
     * @return the var
     */
    @NotNull
    @Guarded(NotNullParametersGuard.class)
    @Guarded(ChainGuard.class) var $error(@NotNull String errorMessage);

    /**
     * $ error.
     *
     * @param error the error
     * @return the var
     */
    @NotNull
    @Guarded(NotNullParametersGuard.class)
    @Guarded(ChainGuard.class) var $error(@NotNull Throwable error);

    /**
     * $ error.
     *
     * @return the var
     */
    @NotNull
    @Guarded(ChainGuard.class) var $error();

    /**
     * $ errors.
     *
     * @return the var
     */
    @NotNull
    @Guarded(NotNullParametersGuard.class)
    @Guarded(ChainGuard.class) var $errors();

    /**
     * $ fail.
     *
     * @param handler the handler
     * @return the var
     */
    @NotNull
    @Guarded(NotNullParametersGuard.class)
    @Guarded(ChainGuard.class) var $fail(@NotNull Consumer<ImmutableList<Throwable>> handler);

    /**
     * $ invalid.
     *
     * @param errorMessage the error message
     * @return the var
     */
    @NotNull
    @Guarded(NotNullParametersGuard.class)
    @Guarded(ChainGuard.class)
    default var $invalid(@NotNull String errorMessage) {
        return $error(errorMessage, ErrorType.VALIDATION);
    }

    /**
     * $ error.
     *
     * @param errorMessage the error message
     * @param type the type
     * @return the var
     */
    @NotNull
    @Guarded(NotNullParametersGuard.class)
    @Guarded(ChainGuard.class) var $error(@NotNull String errorMessage, @NotNull ErrorType type);

    /**
     * Clear errors.
     *
     * @return the var
     */
    @NotNull
    @Guarded(ChainGuard.class)
    var clearErrors();

    /**
     * Error texts.
     *
     * @return the list
     */
    @NotNull
    @Guarded(NotNullCollectionGuard.class) List<String> errorTexts();

    /**
     * Errors immutable list.
     *
     * @return the immutable list
     */
    @NotNull
    @Guarded(NotNullCollectionGuard.class) ImmutableList<Throwable> errors();

    /**
     * Has errors.
     *
     * @return the boolean
     */
    boolean hasErrors();
}
