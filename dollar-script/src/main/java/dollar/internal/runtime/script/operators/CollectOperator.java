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

package dollar.internal.runtime.script.operators;

import com.sillelien.dollar.api.Pipeable;
import com.sillelien.dollar.api.var;
import dollar.internal.runtime.script.SourceNodeOptions;
import dollar.internal.runtime.script.api.DollarParser;
import dollar.internal.runtime.script.api.Scope;
import dollar.internal.runtime.script.api.exceptions.VariableNotFoundException;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.jparsec.Token;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;

import static com.sillelien.dollar.api.DollarStatic.$;
import static com.sillelien.dollar.api.DollarStatic.$void;
import static com.sillelien.dollar.api.types.DollarFactory.fromList;
import static dollar.internal.runtime.script.DollarScriptSupport.*;
import static dollar.internal.runtime.script.parser.Symbols.COLLECT_OP;

public class CollectOperator implements Function<Token, var> {
    @NotNull
    private static final Logger log = LoggerFactory.getLogger("CollectOperator");
    @NotNull
    private final DollarParser parser;
    private final boolean pure;

    public CollectOperator(@NotNull DollarParser dollarParser, boolean pure) {
        parser = dollarParser;
        this.pure = pure;
        assert COLLECT_OP.validForPure(pure);

    }

    @NotNull
    @Override

    public var apply(@NotNull Token token) {
        Object[] objects = (Object[]) token.value();

        var variable = (var) objects[0];
        Object until = objects[1];
        Object unless = objects[2];
        Object loop = objects[3];

        log.debug("Listening to {}", variable.getMetaObject("operation"));
        String varName = variable.getMetaAttribute("variable");


        String id = UUID.randomUUID().toString();
        return node("collect", pure, SourceNodeOptions.NEW_SCOPE, parser, token, Collections.singletonList(variable),
                    (var... in) -> {
                        Scope scopeForVar = getScopeForVar(pure, varName, false, null);

                        if (scopeForVar == null) {
                            throw new VariableNotFoundException(varName, currentScope());
                        }

                        scopeForVar.listen(varName, id, new VarListener((var) unless, (var) until, (var) loop));
                        return $void();

                    });


    }


    private final class VarListener implements Pipeable {
        @NotNull
        final AtomicLong count = new AtomicLong(-1);
        @NotNull
        final ArrayList<var> collected = new ArrayList<>();
        @Nullable
        private final var unless;
        @Nullable
        private final var until;
        @NotNull
        private final var loop;

        private VarListener(@Nullable var unless, @Nullable var until, @NotNull var loop) {
            this.unless = unless;
            this.until = until;
            this.loop = loop;
        }

        @NotNull
        @Override
        public var pipe(var... in2) throws Exception {
            var value = in2[1]._fixDeep();
            count.incrementAndGet();
            log.debug("Count is {} value is {}", count.get(), value);
            inSubScope(true, pure, "collect-body",
                       ns -> {
                           ns.setParameter("count", $(count.get()));
                           ns.setParameter("it", value);

                           if ((unless != null) && unless.isTrue()) {
                               log.debug("Skipping {}", value);
                           } else {
                               log.debug("Adding {}", value);
                               collected.add(value);
                           }
                           var returnValue = $void();
                           ns.setParameter("collected", fromList(collected));
                           log.debug("Collected {}", fromList(collected));
                           final boolean endValue = (until != null) && until.isTrue();
                           if (endValue) {
                               returnValue = loop._fixDeep();
                               collected.clear();
                               count.set(-1);
                               log.debug("Return value  {}", returnValue);
                           }
                           return returnValue;
                       });
            return $void();

        }
    }
}
