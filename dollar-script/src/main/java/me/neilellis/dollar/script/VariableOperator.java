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

package me.neilellis.dollar.script;

import me.neilellis.dollar.script.exceptions.DollarScriptException;
import me.neilellis.dollar.types.DollarFactory;
import me.neilellis.dollar.var;

import java.util.List;

/**
 * @author <a href="http://uk.linkedin.com/in/neilellis">Neil Ellis</a>
 */
public class VariableOperator extends ScopedVarUnaryOperator {


    public VariableOperator(ScriptScope scope) {
        super(scope, null);
    }


    @Override
    public var map(var from) {
        try {
            var lambda = DollarFactory.fromLambda(v -> {
                String key = from.$S();
                try {
                    List<ScriptScope> scopes = scope.getDollarParser().scopes();
                    for (ScriptScope scriptScope : scopes) {
                        if (scriptScope.has(key)) {
                            return scriptScope.get(key);
                        }
                    }
                } catch (AssertionError e) {
                    return scope.getDollarParser().getErrorHandler().handle(source.get(), e);
                } catch (DollarScriptException e) {
                    return scope.getDollarParser().getErrorHandler().handle(source.get(), e);
                } catch (Exception e) {
                    return scope.getDollarParser().getErrorHandler().handle(source.get(), e);
                }
                return scope.get(key);
            });
            scope.listen(from.$S(), lambda);
            lambda.setMetaAttribute("variable", from.$S());
            return lambda;
        } catch (AssertionError e) {
            return scope.getDollarParser().getErrorHandler().handle(source.get(), e);
        } catch (DollarScriptException e) {
            return scope.getDollarParser().getErrorHandler().handle(source.get(), e);
        } catch (Exception e) {
            return scope.getDollarParser().getErrorHandler().handle(source.get(), e);
        }

    }


}
