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

import me.neilellis.dollar.script.DollarScriptSupport;
import me.neilellis.dollar.script.Scope;
import me.neilellis.dollar.script.SourceValue;
import me.neilellis.dollar.var;
import org.codehaus.jparsec.Token;
import org.codehaus.jparsec.functors.Map;

import java.util.Arrays;
import java.util.concurrent.Callable;

/**
 * @author <a href="http://uk.linkedin.com/in/neilellis">Neil Ellis</a>
 */
public class SubscriptOperator implements Map<Token, Map<? super var, ? extends var>> {
    private final Scope scope;

    public SubscriptOperator(Scope scope) {this.scope = scope;}

    @Override public Map<? super var, ? extends var> map(Token token) {
        Object[] rhs = (Object[]) token.value();
        final SourceValue source = new SourceValue(scope, token);
        return lhs -> {
            if (rhs[1] == null) {
                return DollarScriptSupport.wrapReactive(scope, () -> lhs.$get(
                        ((var) rhs[0])), source, "subscript", lhs, (var) rhs[0]);
            } else {
                Callable<var> callable = () -> lhs.$set((var) rhs[0], rhs[1]);
                return DollarScriptSupport.toLambda(scope, callable, source,
                                                    Arrays.asList(lhs, (var) rhs[0], (var) rhs[1]),
                                                    "subscript-assignment");
            }
        };
    }
}
