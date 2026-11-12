"""Offline Linear transport diagnostics; no credentials, requests or agents."""
import io
import json
import unittest
import urllib.error
from unittest.mock import patch
import publish as p


class Response(io.BytesIO):
    def __init__(self, payload, status=200, raw=False):
        super().__init__(payload if raw else json.dumps(payload).encode())
        self.status = status


class LinearTransportTest(unittest.TestCase):
    def setUp(self):
        self.key = 'offline-private-key-do-not-log'
        env = patch.dict(p.os.environ, {'LINEAR_API_KEY': self.key})
        env.start(); self.addCleanup(env.stop)
        network = patch.object(p.urllib.request, 'urlopen', side_effect=AssertionError('Network forbidden'))
        network.start(); self.addCleanup(network.stop)
        sleep = patch.object(p.time, 'sleep')
        self.sleep = sleep.start(); self.addCleanup(sleep.stop)

    def http_error(self, status, payload):
        return urllib.error.HTTPError('https://api.linear.app/graphql', status,
                                      'private reason ' + self.key,
                                      {'Authorization': 'Bearer ' + self.key, 'X-Private-Header': self.key},
                                      io.BytesIO(json.dumps(payload).encode()))

    def validation(self):
        return {'errors': [{'message': 'Argument Validation Error ' + self.key,
                            'extensions': {'code': 'INPUT_ERROR', 'validationErrors': [
                                {'property': 'id', 'constraints': {'isUuid': 'id must be UUIDv4 ' + self.key}},
                                {'property': 'Authorization', 'value': self.key}]}}]}

    def assert_redacted(self, message):
        self.assertNotIn(self.key, message)
        self.assertNotIn('Authorization', message)
        self.assertNotIn('Bearer', message)
        self.assertNotIn('X-Private-Header', message)

    def test_success_returns_data(self):
        with patch.object(p.urllib.request, 'urlopen', return_value=Response({'data': {'issue': {'id': 'safe'}}})) as api:
            self.assertEqual(p.linear('query{}', {}), {'issue': {'id': 'safe'}})
        self.assertEqual(api.call_count, 1)

    def test_http400_graphql_validation_is_actionable_and_not_retried(self):
        with patch.object(p.urllib.request, 'urlopen', side_effect=self.http_error(400, self.validation())) as api:
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('mutation{}', {})
        text = str(caught.exception)
        for value in ['HTTP 400', 'Argument Validation Error', 'INPUT_ERROR', 'validation fields: id']:
            self.assertIn(value, text)
        self.assert_redacted(text)
        self.assertFalse(caught.exception.retryable)
        self.assertEqual(api.call_count, 1)
        self.sleep.assert_not_called()

    def test_http200_graphql_validation_is_not_silently_successful(self):
        with patch.object(p.urllib.request, 'urlopen', return_value=Response(self.validation())) as api:
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('mutation{}', {})
        self.assertIn('HTTP 200', str(caught.exception))
        self.assertIn('Argument Validation Error', str(caught.exception))
        self.assert_redacted(str(caught.exception))
        self.assertEqual(api.call_count, 1)

    def test_auth_status_with_sensitive_headers_reason_and_body(self):
        error = self.http_error(401, {'errors': [{'message': self.key, 'extensions': {'code': 'UNAUTHENTICATED'}}]})
        with patch.object(p.urllib.request, 'urlopen', side_effect=error):
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertIn('HTTP 401', str(caught.exception))
        self.assertIn('UNAUTHENTICATED', str(caught.exception))
        self.assert_redacted(str(caught.exception))

    def test_rate_limit_retries_and_eventually_returns_data(self):
        with patch.object(p.urllib.request, 'urlopen', side_effect=[
                self.http_error(429, {}), self.http_error(429, {}), Response({'data': {'ok': True}})]) as api:
            self.assertEqual(p.linear('query{}', {}), {'ok': True})
        self.assertEqual(api.call_count, 3)
        self.assertEqual(self.sleep.call_count, 2)

    def test_server_error_preserves_status_after_bounded_retries(self):
        errors = [self.http_error(503, {'errors': [{'message': self.key, 'extensions': {'code': 'INTERNAL_SERVER_ERROR'}}]}) for _ in range(3)]
        with patch.object(p.urllib.request, 'urlopen', side_effect=errors) as api:
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertIn('HTTP 503', str(caught.exception))
        self.assertIn('after 3 attempts', str(caught.exception))
        self.assert_redacted(str(caught.exception))
        self.assertEqual(api.call_count, 3)

    def test_network_failures_never_echo_exception_credentials(self):
        with patch.object(p.urllib.request, 'urlopen', side_effect=OSError('Authorization: Bearer ' + self.key)) as api:
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertIn('HTTP unavailable', str(caught.exception))
        self.assertIn('after 3 attempts', str(caught.exception))
        self.assert_redacted(str(caught.exception))
        self.assertEqual(api.call_count, 3)

    def test_create_transport_single_attempt_leaves_reconciliation_to_workpad(self):
        with patch.object(p.urllib.request, 'urlopen', side_effect=TimeoutError(self.key)) as api:
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('mutation{}', {}, attempts=1)
        self.assertEqual(api.call_count, 1)
        self.sleep.assert_not_called()
        self.assert_redacted(str(caught.exception))

    def test_unrecognized_error_messages_and_codes_are_not_echoed(self):
        payload = {'data': {'partial': 'private'}, 'errors': [{'message': self.key,
                    'extensions': {'code': self.key, 'request': {'headers': {'Authorization': self.key}}}}]}
        with patch.object(p.urllib.request, 'urlopen', return_value=Response(payload)):
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertIn('HTTP 200', str(caught.exception))
        self.assert_redacted(str(caught.exception))

    def test_invalid_json_never_echoes_response(self):
        with patch.object(p.urllib.request, 'urlopen', return_value=Response(self.key.encode(), raw=True)):
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertIn('invalid JSON response (HTTP 200)', str(caught.exception))
        self.assert_redacted(str(caught.exception))

    def test_non_json_http_error_still_reports_status(self):
        error = self.http_error(403, {})
        error.fp = io.BytesIO(self.key.encode())
        with patch.object(p.urllib.request, 'urlopen', side_effect=error):
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertIn('HTTP 403', str(caught.exception))
        self.assert_redacted(str(caught.exception))

    def test_malformed_validation_details_do_not_escape_sanitization(self):
        payload = self.validation()
        payload['errors'][0]['extensions']['validationErrors'] = [
            {'property': {'private': self.key}}, {'property': [self.key]}, None]
        with patch.object(p.urllib.request, 'urlopen', side_effect=self.http_error(400, payload)):
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertIn('HTTP 400', str(caught.exception))
        self.assertIn('Argument Validation Error', str(caught.exception))
        self.assert_redacted(str(caught.exception))

    def test_missing_key_fails_without_transport(self):
        with patch.dict(p.os.environ, {}, clear=True), patch.object(p.urllib.request, 'urlopen') as api:
            with self.assertRaises(p.PublicationError) as caught:
                p.linear('query{}', {})
        self.assertFalse(caught.exception.retryable)
        api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
