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

import dollar.api.collections.ImmutableList;
import dollar.api.guard.ChainGuard;
import dollar.api.guard.Guarded;
import dollar.api.guard.NotNullCollectionGuard;
import dollar.api.guard.NotNullGuard;
import dollar.api.script.SourceSegment;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

public interface VarInternal {
    /**
     * Returns a deep copy of this object. You should never need to use this operation as all {@link
     * var} objects are immutable. Therefore they can freely be shared between threads.
     *
     * @return a deep copy of this object
     */
    @NotNull
    @Guarded(ChainGuard.class)
    var $copy();

    @Guarded(ChainGuard.class)
    @Guarded(NotNullGuard.class)
    @Guarded(NotNullCollectionGuard.class)
    @NotNull
    var $copy(@NotNull ImmutableList<Throwable> errors);

    /**
     * Like $unwrap() except it causes lambda evaluation but does not propagate through lists and maps.
     */
    @NotNull
    @Guarded(ChainGuard.class)
    var $fix(boolean parallel);

    @NotNull
    @Guarded(ChainGuard.class)
    var $fix(int depth, boolean parallel);

    @NotNull
    @Guarded(ChainGuard.class)
    default var $fixDeep() { return $fixDeep(false);}

    @NotNull
    @Guarded(ChainGuard.class)
    var $fixDeep(boolean parallel);

    /**
     * Attempt to predict what type this object is. For static types this will predict the the same value as returned by
     * {@link var#$type()}
     *
     * @return a prediction of what type this object may be.
     */
    @Nullable
    TypePrediction predictType();

    @Nullable
    default SourceSegment source() {
        return null;
    }


    /**
     * Unwraps any wrapper classes around the actual type class.
     *
     * @return an unwrapped class.
     */
    @Guarded(ChainGuard.class)
    @Nullable
    var $unwrap();


    @NotNull
    var $constrain(@NotNull var constraint, @NotNull String constraintSource);

    @Nullable
    String constraintLabel();
}