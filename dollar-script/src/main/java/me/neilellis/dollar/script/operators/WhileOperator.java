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

package me.neilellis.dollar.script.operators;

import me.neilellis.dollar.script.DollarParser;
import me.neilellis.dollar.script.Scope;
import me.neilellis.dollar.types.DollarFactory;
import me.neilellis.dollar.var;
import org.codehaus.jparsec.functors.Map;

import static me.neilellis.dollar.DollarStatic.$;

/**
 * @author <a href="http://uk.linkedin.com/in/neilellis">Neil Ellis</a>
 */
public class WhileOperator implements Map<var, Map<? super var, ? extends var>> {
    private final Scope scope;
    private final DollarParser parser;
    private boolean pure;

    public WhileOperator(DollarParser dollarParser, Scope scope, boolean pure) {
        this.parser = dollarParser;
        this.scope = scope;
        this.pure = pure;
    }

    public Map<? super var, ? extends var> map(var lhs) {
        return rhs -> DollarFactory.fromLambda(l -> parser.inScope(pure, "while", scope, newScope -> {
            while (lhs.isTrue()) {
                rhs._fixDeep();
            }
            return $(false);
        }));
    }
}
